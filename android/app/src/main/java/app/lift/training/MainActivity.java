package app.lift.training;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private boolean pageLoaded;
    private boolean openSession;
    @Override public void onCreate(Bundle savedInstanceState) {
        // A notification can create the activity instead of calling onNewIntent.
        Intent initialIntent = getIntent();
        openSession = initialIntent != null && "seance".equals(initialIntent.getStringExtra("liftRoute"));
        registerPlugin(WorkoutActivityPlugin.class);
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView view) {
                pageLoaded = true;
                showSession();
            }
        });
        super.onCreate(savedInstanceState);
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && "seance".equals(intent.getStringExtra("liftRoute"))) {
            openSession = true;
            showSession();
        }
    }
    private void showSession() {
        if (bridge != null && pageLoaded && openSession) {
            openSession = false;
            bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript("window.location.hash = '#/seance'", null));
        }
    }
}
