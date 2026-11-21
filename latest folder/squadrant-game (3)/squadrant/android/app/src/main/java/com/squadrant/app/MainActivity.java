package com.squadrant.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SquadrantNetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
