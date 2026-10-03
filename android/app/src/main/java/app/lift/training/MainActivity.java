package app.lift.training;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutActivityPlugin.class);
        super.onCreate(savedInstanceState);
        route(getIntent());
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        route(intent);
    }
    private void route(Intent intent) {
        if (intent != null && "seance".equals(intent.getStringExtra("liftRoute"))) {
            bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript("window.location.hash = '#/seance'", null));
        }
    }
}
