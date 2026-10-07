package app.lift.training;

import android.Manifest;
import android.content.pm.PackageManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import org.json.JSONObject;

/** Native clock continues when Capacitor's WebView is suspended. Never restarts an abandoned workout. */
public class WorkoutService extends Service {
    private static final String CHANNEL = "lift-workout";
    private static final int ID = 7400;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private JSONObject state;
    private boolean resting;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (state == null || System.currentTimeMillis() >= state.optLong("expiresAt")) {
                stopSelf();
                return;
            }
            boolean next = state.optLong("restEndAt", 0) > System.currentTimeMillis();
            if (next != resting) {
                resting = next;
                if (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                    getSystemService(NotificationManager.class).notify(ID, notification());
                } else {
                    stopSelf();
                    return;
                }
            }
            handler.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, getString(R.string.workout_channel), NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(getString(R.string.workout_channel_description));
            channel.setSound(null, null);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            String payload = intent == null ? null : intent.getStringExtra("state");
            if (payload == null) { stopSelf(); return START_NOT_STICKY; }
            state = new JSONObject(payload);
            if (state.optInt("version") != 1) throw new IllegalArgumentException("Unknown workout state version");
            resting = state.optLong("restEndAt", 0) > System.currentTimeMillis();
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(ID, notification());
            }
            handler.removeCallbacks(tick);
            handler.post(tick);
        } catch (Exception e) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private Notification notification() {
        Intent open = new Intent(this, MainActivity.class);
        open.putExtra("liftRoute", "seance");
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 7400, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String status = state.optString(resting ? "restLabel" : "readyLabel");
        if (!resting && !state.isNull("restEndAt")) {
            status = "Repos".equals(state.optString("restLabel")) ? "Repos terminé" : "Rest over";
        }
        String title = "Lift · " + state.optString("workoutType") + " · " + status;
        String text = state.optString("exercise") + " · " + state.optString("setLabel");
        String detail = state.optString("detail");
        String progress = state.optInt("completedSets") + "/" + state.optInt("totalSets") + " " + state.optString("progressLabel");
        Notification.Builder builder = (Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this))
            .setSmallIcon(R.drawable.ic_workout)
            .setContentTitle(title).setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text + "\n" + detail + "\n" + progress))
            .setContentIntent(content).setOngoing(true).setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setProgress(state.optInt("totalSets"), state.optInt("completedSets"), false);
        if (resting) {
            // A system Chronometer, not JavaScript ticks, renders the countdown on the lock screen.
            builder.setWhen(state.optLong("restEndAt")).setShowWhen(true)
                .setUsesChronometer(true).setChronometerCountDown(true);
        } else builder.setShowWhen(false);
        return builder.build();
    }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
