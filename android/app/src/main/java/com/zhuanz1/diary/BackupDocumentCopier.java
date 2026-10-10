package com.zhuanz1.diary;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/** Stream-only copy logic, independently testable without an Android runtime. */
final class BackupDocumentCopier {
    interface Destination {
        OutputStream open() throws IOException;
    }

    static final class CopyFailure extends IOException {
        final boolean targetMayBePartial;

        CopyFailure(Exception cause, boolean targetMayBePartial) {
            super(cause.getMessage(), cause);
            this.targetMayBePartial = targetMayBePartial;
        }
    }

    static void copy(File source, Destination destination) throws CopyFailure {
        boolean opened = false;
        boolean complete = false;
        try {
            if (!source.isFile() || source.length() == 0) {
                throw new IOException("临时备份文件不存在或为空。");
            }
            // The target must not be touched if a prior process lost its source.
            try (InputStream input = new FileInputStream(source)) {
                OutputStream stream = destination.open();
                if (stream == null) throw new IOException("无法写入所选位置。");
                opened = true;
                try (OutputStream output = stream) {
                    byte[] buffer = new byte[64 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    output.flush();
                }
                complete = true;
            }
        } catch (Exception error) {
            throw new CopyFailure(error, opened && !complete);
        }
    }

    private BackupDocumentCopier() {}
}
