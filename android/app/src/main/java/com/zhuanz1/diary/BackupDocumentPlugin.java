package com.zhuanz1.diary;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.concurrent.atomic.AtomicBoolean;

/** Saves a durable, operation-specific private backup through Android's document picker. */
@CapacitorPlugin(name = "BackupDocument")
public class BackupDocumentPlugin extends Plugin {
    private static final String PREFERENCES = "gentle-diary.backup-document";
    private static final String PENDING_FILE_NAME = "pendingFileName";
    private static final String PENDING_SOURCE_NAME = "pendingSourceName";
    private static final String PENDING_URI = "pendingUri";
    private static final String BACKUP_DIRECTORY = "gentle-diary/backups";
    private static final String OUTCOME_STATE = "outcomeState";
    private static final String OUTCOME_MESSAGE = "outcomeMessage";
    private final AtomicBoolean active = new AtomicBoolean(false);
    private final AtomicBoolean copying = new AtomicBoolean(false);

    @Override
    public void load() {
        String fileName = preferences().getString(PENDING_FILE_NAME, null);
        String uri = preferences().getString(PENDING_URI, null);
        if (isBackupFileName(fileName) && uri != null && uri.startsWith("content://")) {
            // A process may have been reclaimed just after the picker returned.
            // Re-copying with truncation is idempotent; no JS call survives that process.
            active.set(true);
            copyToDocument(null, pendingSource(fileName), Uri.parse(uri));
        }
        cleanupAbandonedSources();
    }

    @PluginMethod
    public void getRecoveryStatus(PluginCall call) {
        JSObject response = new JSObject();
        response.put("state", copying.get() ? "copying" : active.get() ? "choosing"
                : preferences().getString(OUTCOME_STATE, "idle"));
        response.put("message", preferences().getString(OUTCOME_MESSAGE, ""));
        call.resolve(response);
    }

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String sourceName = call.getString("sourceFileName");
        if (!isBackupFileName(fileName) || !isSourceFileName(sourceName)) {
            call.reject("备份文件名无效。");
            return;
        }

        File source = new File(new File(getContext().getFilesDir(), BACKUP_DIRECTORY), sourceName);
        if (!source.isFile() || source.length() == 0) {
            call.reject("临时备份文件不存在或为空。");
            return;
        }

        if (!active.compareAndSet(false, true)) {
            call.reject("已有备份正在保存，请稍后重试。", "BACKUP_BUSY");
            return;
        }

        // A force-stopped chooser has no live callback. A fresh operation may replace
        // that abandoned context, but only its private source (never a user document).
        String previousName = preferences().getString(PENDING_FILE_NAME, null);
        File previousSource = isBackupFileName(previousName) ? pendingSource(previousName) : null;

        if (!preferences().edit().putString(PENDING_FILE_NAME, fileName)
                .putString(PENDING_SOURCE_NAME, sourceName).remove(PENDING_URI)
                .remove(OUTCOME_STATE).remove(OUTCOME_MESSAGE).commit()) {
            active.set(false);
            call.reject("无法保存备份操作状态，请重新导出。");
            return;
        }
        if (previousSource != null && !previousSource.equals(source)) previousSource.delete();
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        try {
            startActivityForResult(call, intent, "onDocumentCreated");
        } catch (Exception error) {
            finish("failed", "无法打开系统文件保存窗口，请重新导出。", source, null);
            call.reject("无法打开系统文件保存窗口。", null, error);
        }
    }

    @ActivityCallback
    private void onDocumentCreated(PluginCall call, ActivityResult result) {
        String fileName = preferences().getString(PENDING_FILE_NAME, null);
        String sourceName = preferences().getString(PENDING_SOURCE_NAME, null);

        if (call != null && call.getString("sourceFileName") != null
                && !call.getString("sourceFileName").equals(sourceName)) {
            call.reject("备份操作已过期，请重新导出。");
            return;
        }

        if (!isBackupFileName(fileName)) {
            active.set(false);
            if (call != null) call.reject("备份保存上下文已丢失，请重新导出。");
            return;
        }

        File source = pendingSource(fileName);
        if (result.getResultCode() != Activity.RESULT_OK) {
            finish("idle", "", source, null);
            if (call != null) {
                JSObject response = new JSObject();
                response.put("canceled", true);
                call.resolve(response);
            }
            return;
        }

        Uri destination = result.getData() == null ? null : result.getData().getData();
        if (destination == null) {
            finish("failed", "系统没有返回保存位置，请重新导出。", source, null);
            if (call != null) call.reject("系统没有返回保存位置，请重新导出。");
            return;
        }

        try {
            getContext().getContentResolver().takePersistableUriPermission(
                    destination, Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // The transient grant still permits the immediate copy.
        }
        if (!preferences().edit().putString(PENDING_URI, destination.toString()).commit()) {
            String message = "无法保存备份操作状态，请重新导出。";
            if (!deletePartial(destination)) message += " 目标可能是空文件，请核对后手动删除。";
            finish("failed", message, source, destination);
            if (call != null) call.reject(message);
            return;
        }
        copyToDocument(call, source, destination);
    }

    private void copyToDocument(PluginCall call, File source, Uri destination) {
        if (!copying.compareAndSet(false, true)) {
            if (call != null) call.reject("已有备份正在保存，请稍后重试。", "BACKUP_BUSY");
            return;
        }
        // Large JSON backups must not be copied on the Android UI thread.
        getBridge().execute(() -> {
            try {
                BackupDocumentCopier.copy(source,
                        () -> getContext().getContentResolver().openOutputStream(destination, "wt"));
                boolean recorded = finish("saved", "备份保存已完成，请核对目标文件。", source, destination);
                if (call != null) {
                    JSObject response = new JSObject();
                    response.put("canceled", false);
                    if (!recorded) response.put("cleanupWarning", "备份已写入，但操作状态清理失败，请核对文件。");
                    call.resolve(response);
                }
            } catch (Exception error) {
                String message = "备份写入失败，请重新导出并核对目标文件。";
                if (error instanceof BackupDocumentCopier.CopyFailure
                        && ((BackupDocumentCopier.CopyFailure) error).targetMayBePartial) {
                    if (!deletePartial(destination)) message += " 目标可能是不完整文件，请勿用于恢复。";
                } else {
                    message += " 未删除目标文件，请核对它是否已完整保存。";
                }
                finish("failed", message, source, destination);
                if (call != null) call.reject(message, null, error);
            } finally {
                copying.set(false);
                active.set(false);
            }
        });
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Activity.MODE_PRIVATE);
    }

    private boolean finish(String state, String message, File source, Uri destination) {
        // Commit completion together with clearing the retry context BEFORE deleting
        // its durable source. A crash cannot turn a completed target into a deletion.
        boolean recorded = preferences().edit().putString(OUTCOME_STATE, state)
                .putString(OUTCOME_MESSAGE, message).remove(PENDING_FILE_NAME)
                .remove(PENDING_SOURCE_NAME).remove(PENDING_URI).commit();
        if (recorded) {
            source.delete();
            if (destination != null) {
                try {
                    getContext().getContentResolver().releasePersistableUriPermission(
                            destination, Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (SecurityException ignored) {
                    // The provider may have issued only a transient grant.
                }
            }
        }
        active.set(false);
        return recorded;
    }

    private boolean deletePartial(Uri destination) {
        try {
            return DocumentsContract.deleteDocument(getContext().getContentResolver(), destination);
        } catch (Exception ignored) {
            return false;
        }
    }

    private File pendingSource(String fileName) {
        String sourceName = preferences().getString(PENDING_SOURCE_NAME, null);
        // Compatibility with a chooser opened by an older Debug/app version.
        if (isSourceFileName(sourceName)) {
            return new File(new File(getContext().getFilesDir(), BACKUP_DIRECTORY), sourceName);
        }
        return new File(new File(getContext().getCacheDir(), BACKUP_DIRECTORY), fileName);
    }

    private boolean isBackupFileName(String fileName) {
        return fileName != null && fileName.matches("gentle-diary-backup-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json");
    }

    private boolean isSourceFileName(String sourceName) {
        return sourceName != null && sourceName.matches("gentle-diary-backup-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-zA-Z0-9-]+\\.json");
    }

    private void cleanupAbandonedSources() {
        String pending = preferences().getString(PENDING_SOURCE_NAME,
                preferences().getString(PENDING_FILE_NAME, null));
        long cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L;
        for (File root : new File[] { getContext().getFilesDir(), getContext().getCacheDir() }) {
            File[] files = new File(root, BACKUP_DIRECTORY).listFiles();
            if (files == null) continue;
            for (File file : files) {
                if (file.isFile() && (isSourceFileName(file.getName()) || isBackupFileName(file.getName()))
                        && !file.getName().equals(pending) && file.lastModified() > 0
                        && file.lastModified() < cutoff) file.delete();
            }
        }
    }
}
