package com.zhuanz1.diary;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupDocumentPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
