package com.zhuanz1.diary;

import static org.junit.Assert.*;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class BackupDocumentCopierTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();

    private File source(byte[] bytes) throws IOException {
        File file = temporary.newFile();
        Files.write(file.toPath(), bytes);
        return file;
    }

    @Test public void copiesAcrossChunkBoundariesWithoutChangingBytes() throws Exception {
        byte[] bytes = new byte[192 * 1024 + 13];
        for (int index = 0; index < bytes.length; index++) bytes[index] = (byte) (index % 251);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        BackupDocumentCopier.copy(source(bytes), () -> output);
        assertArrayEquals(bytes, output.toByteArray());
    }

    @Test public void missingRecoverySourceNeverOpensOrTruncatesDestination() throws Exception {
        AtomicBoolean opened = new AtomicBoolean(false);
        try {
            BackupDocumentCopier.copy(new File(temporary.getRoot(), "missing"), () -> {
                opened.set(true);
                return new ByteArrayOutputStream();
            });
            fail("Expected rejection");
        } catch (BackupDocumentCopier.CopyFailure error) {
            assertFalse(opened.get());
            assertFalse(error.targetMayBePartial);
        }
    }

    @Test public void emptyRecoverySourceNeverOpensDestination() throws Exception {
        try {
            BackupDocumentCopier.copy(source(new byte[0]), () -> {
                fail("Must not open destination");
                return null;
            });
            fail("Expected rejection");
        } catch (BackupDocumentCopier.CopyFailure error) {
            assertFalse(error.targetMayBePartial);
        }
    }

    @Test public void unavailableProviderDoesNotAuthorizeDestinationDeletion() throws Exception {
        try {
            BackupDocumentCopier.copy(source(new byte[] { 1 }), () -> { throw new IOException("unavailable"); });
            fail("Expected rejection");
        } catch (BackupDocumentCopier.CopyFailure error) {
            assertFalse(error.targetMayBePartial);
        }
    }

    @Test public void writeFailureMarksOnlyAnOpenedTargetAsPartial() throws Exception {
        try {
            BackupDocumentCopier.copy(source(new byte[] { 1, 2 }), () -> new OutputStream() {
                @Override public void write(int value) throws IOException { throw new IOException("disk full"); }
            });
            fail("Expected rejection");
        } catch (BackupDocumentCopier.CopyFailure error) {
            assertTrue(error.targetMayBePartial);
            assertEquals("disk full", error.getMessage());
        }
    }

    @Test public void closeFailureIsNotReportedAsACompleteBackup() throws Exception {
        try {
            BackupDocumentCopier.copy(source(new byte[] { 1, 2 }), () -> new ByteArrayOutputStream() {
                @Override public void close() throws IOException { throw new IOException("close failed"); }
            });
            fail("Expected rejection");
        } catch (BackupDocumentCopier.CopyFailure error) {
            assertTrue(error.targetMayBePartial);
        }
    }
}
