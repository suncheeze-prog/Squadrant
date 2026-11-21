package com.squadrant.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * SquadrantNet — serverless LAN multiplayer transport for Squadrant.
 *
 * Host:  startServer()  → opens a TCP ServerSocket + registers an NSD service
 *                         so guests can auto-discover it (no IP typing).
 * Guest: startDiscovery() → finds hosts via NSD; connectToHost() opens a TCP socket.
 *
 * Wire protocol: newline-delimited UTF-8 JSON strings, one message per line.
 * Exactly one peer connection is supported at a time (the game is 1v1).
 */
@CapacitorPlugin(name = "SquadrantNet")
public class SquadrantNetPlugin extends Plugin {

    private static final String TAG = "SquadrantNet";
    private static final String SERVICE_TYPE = "_squadrant._tcp.";

    private NsdManager nsdManager;
    private NsdManager.RegistrationListener registrationListener;
    private NsdManager.DiscoveryListener discoveryListener;

    private ServerSocket serverSocket;
    private Socket peerSocket;            // active peer connection (host->guest or guest->host)
    private BufferedWriter writer;

    private Thread acceptThread;
    private Thread readThread;
    private final ExecutorService sendExecutor = Executors.newSingleThreadExecutor();

    private WifiManager.MulticastLock multicastLock;
    private volatile boolean serverRunning = false;

    // ── NSD resolve queue (NsdManager resolves one service at a time) ──────────
    private final ArrayDeque<NsdServiceInfo> resolveQueue = new ArrayDeque<>();
    private boolean resolving = false;

    private NsdManager nsd() {
        if (nsdManager == null) {
            nsdManager = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        }
        return nsdManager;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  IP ADDRESS
    // ════════════════════════════════════════════════════════════════════════
    @PluginMethod
    public void getIpAddress(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ip", resolveLocalIp());
        call.resolve(ret);
    }

    private String resolveLocalIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "resolveLocalIp failed", e);
        }
        return "0.0.0.0";
    }

    // ════════════════════════════════════════════════════════════════════════
    //  HOST — TCP server + NSD registration
    // ════════════════════════════════════════════════════════════════════════
    @PluginMethod
    public void startServer(final PluginCall call) {
        if (serverRunning) {
            call.reject("Server already running");
            return;
        }
        final int requestedPort = call.getInt("port", 0);
        final String serviceName = call.getString("serviceName", "Squadrant");
        final String difficulty = call.getString("difficulty", "easy");
        final String hostName = call.getString("hostName", "Host");

        acquireMulticastLock();

        try {
            serverSocket = new ServerSocket(requestedPort);
            serverRunning = true;
            final int actualPort = serverSocket.getLocalPort();

            acceptThread = new Thread(() -> {
                try {
                    while (serverRunning) {
                        Socket sock = serverSocket.accept();
                        synchronized (SquadrantNetPlugin.this) {
                            if (peerSocket != null && !peerSocket.isClosed()) {
                                // Already have a player — room is full, reject extra.
                                try { sock.close(); } catch (Exception ignore) {}
                                continue;
                            }
                            attachPeer(sock);
                        }
                        notifyListeners("clientConnected", new JSObject(), true);
                    }
                } catch (Exception e) {
                    if (serverRunning) Log.w(TAG, "accept loop ended", e);
                }
            });
            acceptThread.setDaemon(true);
            acceptThread.start();

            registerNsdService(serviceName, actualPort, difficulty, hostName);

            JSObject ret = new JSObject();
            ret.put("port", actualPort);
            ret.put("ip", resolveLocalIp());
            call.resolve(ret);
        } catch (Exception e) {
            serverRunning = false;
            releaseMulticastLock();
            call.reject("Failed to start server: " + e.getMessage());
        }
    }

    private void registerNsdService(String serviceName, int port, String difficulty, String hostName) {
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName(serviceName);
        info.setServiceType(SERVICE_TYPE);
        info.setPort(port);
        info.setAttribute("difficulty", difficulty);
        info.setAttribute("host", hostName);

        registrationListener = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo info) {
                Log.i(TAG, "NSD registered: " + info.getServiceName());
            }
            @Override public void onRegistrationFailed(NsdServiceInfo info, int errorCode) {
                Log.w(TAG, "NSD registration failed: " + errorCode);
            }
            @Override public void onServiceUnregistered(NsdServiceInfo info) {
                Log.i(TAG, "NSD unregistered");
            }
            @Override public void onUnregistrationFailed(NsdServiceInfo info, int errorCode) {
                Log.w(TAG, "NSD unregistration failed: " + errorCode);
            }
        };
        nsd().registerService(info, NsdManager.PROTOCOL_DNS_SD, registrationListener);
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        serverRunning = false;
        unregisterNsd();
        closePeer();
        try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignore) {}
        serverSocket = null;
        releaseMulticastLock();
        call.resolve();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  GUEST — NSD discovery
    // ════════════════════════════════════════════════════════════════════════
    @PluginMethod
    public void startDiscovery(final PluginCall call) {
        acquireMulticastLock();
        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override public void onStartDiscoveryFailed(String type, int errorCode) {
                Log.w(TAG, "discovery start failed: " + errorCode);
            }
            @Override public void onStopDiscoveryFailed(String type, int errorCode) {
                Log.w(TAG, "discovery stop failed: " + errorCode);
            }
            @Override public void onDiscoveryStarted(String type) {
                Log.i(TAG, "discovery started");
            }
            @Override public void onDiscoveryStopped(String type) {
                Log.i(TAG, "discovery stopped");
            }
            @Override public void onServiceFound(NsdServiceInfo info) {
                if (!info.getServiceType().contains("_squadrant")) return;
                enqueueResolve(info);
            }
            @Override public void onServiceLost(NsdServiceInfo info) {
                JSObject ev = new JSObject();
                ev.put("name", info.getServiceName());
                notifyListeners("serviceLost", ev, true);
            }
        };
        nsd().discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
        call.resolve();
    }

    private synchronized void enqueueResolve(NsdServiceInfo info) {
        resolveQueue.add(info);
        if (!resolving) resolveNext();
    }

    private synchronized void resolveNext() {
        if (resolveQueue.isEmpty()) { resolving = false; return; }
        resolving = true;
        NsdServiceInfo next = resolveQueue.poll();
        nsd().resolveService(next, new NsdManager.ResolveListener() {
            @Override public void onResolveFailed(NsdServiceInfo info, int errorCode) {
                Log.w(TAG, "resolve failed: " + errorCode + " for " + info.getServiceName());
                synchronized (SquadrantNetPlugin.this) { resolveNext(); }
            }
            @Override public void onServiceResolved(NsdServiceInfo info) {
                JSObject ev = new JSObject();
                ev.put("name", info.getServiceName());
                ev.put("host", info.getHost() != null ? info.getHost().getHostAddress() : "");
                ev.put("port", info.getPort());
                Map<String, byte[]> attrs = info.getAttributes();
                if (attrs != null) {
                    byte[] diff = attrs.get("difficulty");
                    byte[] hostName = attrs.get("host");
                    ev.put("difficulty", diff != null ? new String(diff, StandardCharsets.UTF_8) : "easy");
                    ev.put("hostName", hostName != null ? new String(hostName, StandardCharsets.UTF_8) : info.getServiceName());
                }
                notifyListeners("serviceFound", ev, true);
                synchronized (SquadrantNetPlugin.this) { resolveNext(); }
            }
        });
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        try {
            if (discoveryListener != null) nsd().stopServiceDiscovery(discoveryListener);
        } catch (Exception ignore) {}
        discoveryListener = null;
        synchronized (this) { resolveQueue.clear(); resolving = false; }
        releaseMulticastLock();
        call.resolve();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  GUEST — connect to host
    // ════════════════════════════════════════════════════════════════════════
    @PluginMethod
    public void connectToHost(final PluginCall call) {
        final String host = call.getString("host");
        final int port = call.getInt("port", 0);
        if (host == null || port == 0) {
            call.reject("host and port are required");
            return;
        }
        new Thread(() -> {
            try {
                Socket sock = new Socket();
                sock.connect(new java.net.InetSocketAddress(host, port), 10000);
                synchronized (SquadrantNetPlugin.this) { attachPeer(sock); }
                notifyListeners("connected", new JSObject(), true);
                call.resolve();
            } catch (Exception e) {
                call.reject("Connection failed: " + e.getMessage());
            }
        }).start();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SHARED — peer socket plumbing
    // ════════════════════════════════════════════════════════════════════════
    private void attachPeer(Socket sock) {
        peerSocket = sock;
        try {
            writer = new BufferedWriter(new OutputStreamWriter(sock.getOutputStream(), StandardCharsets.UTF_8));
            final BufferedReader reader = new BufferedReader(new InputStreamReader(sock.getInputStream(), StandardCharsets.UTF_8));
            readThread = new Thread(() -> {
                try {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        JSObject ev = new JSObject();
                        ev.put("data", line);
                        notifyListeners("messageReceived", ev, true);
                    }
                } catch (Exception e) {
                    Log.i(TAG, "read loop ended: " + e.getMessage());
                } finally {
                    notifyListeners("disconnected", new JSObject(), true);
                    notifyListeners("clientDisconnected", new JSObject(), true);
                    closePeer();
                }
            });
            readThread.setDaemon(true);
            readThread.start();
        } catch (Exception e) {
            Log.w(TAG, "attachPeer failed", e);
        }
    }

    @PluginMethod
    public void sendMessage(final PluginCall call) {
        final String data = call.getString("data");
        if (data == null) { call.reject("data is required"); return; }
        sendExecutor.execute(() -> {
            try {
                BufferedWriter w = writer;
                if (w == null) { call.reject("No active connection"); return; }
                synchronized (SquadrantNetPlugin.this) {
                    w.write(data);
                    w.write("\n");
                    w.flush();
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("send failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void closeConnection(PluginCall call) {
        closePeer();
        call.resolve();
    }

    private synchronized void closePeer() {
        try { if (writer != null) writer.close(); } catch (Exception ignore) {}
        try { if (peerSocket != null) peerSocket.close(); } catch (Exception ignore) {}
        writer = null;
        peerSocket = null;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  helpers
    // ════════════════════════════════════════════════════════════════════════
    private void acquireMulticastLock() {
        try {
            if (multicastLock == null) {
                WifiManager wifi = (WifiManager) getContext().getApplicationContext()
                        .getSystemService(Context.WIFI_SERVICE);
                multicastLock = wifi.createMulticastLock("squadrant-nsd");
                multicastLock.setReferenceCounted(true);
            }
            multicastLock.acquire();
        } catch (Exception e) {
            Log.w(TAG, "multicast lock acquire failed", e);
        }
    }

    private void releaseMulticastLock() {
        try {
            if (multicastLock != null && multicastLock.isHeld()) multicastLock.release();
        } catch (Exception ignore) {}
    }

    private void unregisterNsd() {
        try {
            if (registrationListener != null) nsd().unregisterService(registrationListener);
        } catch (Exception ignore) {}
        registrationListener = null;
    }

    @Override
    protected void handleOnDestroy() {
        serverRunning = false;
        unregisterNsd();
        try { if (discoveryListener != null) nsd().stopServiceDiscovery(discoveryListener); } catch (Exception ignore) {}
        closePeer();
        try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignore) {}
        releaseMulticastLock();
        super.handleOnDestroy();
    }
}
