import Toybox.Application;

// Persists room code and a stable device identifier across app launches.
module Storage {

    const KEY_ROOM_CODE = "roomCode";
    const KEY_SOURCE_ID = "sourceId";

    // Returns the last saved room code, or null.
    function loadRoomCode() {
        return Application.Storage.getValue(KEY_ROOM_CODE);
    }

    function saveRoomCode(code) {
        Application.Storage.setValue(KEY_ROOM_CODE, code);
    }

    // Returns a stable UUID for this watch. Generated once and stored forever.
    // Used as sourceId in Firestore command documents.
    function getSourceId() {
        var id = Application.Storage.getValue(KEY_SOURCE_ID);
        if (id == null) {
            id = generateUuid();
            Application.Storage.setValue(KEY_SOURCE_ID, id);
        }
        return id;
    }

    // Generates a random UUID v4 string (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
    function generateUuid() {
        var hex = "0123456789abcdef";
        var parts = new [32];
        for (var i = 0; i < 32; i++) {
            parts[i] = hex.substring(Math.rand() % 16, (Math.rand() % 16) + 1);
        }
        // Insert hyphens and version/variant bits at standard positions
        parts[12] = "4"; // version 4
        parts[16] = hex.substring(8 + (Math.rand() % 4), 9 + (Math.rand() % 4)); // variant bits
        var s = "";
        for (var i = 0; i < 32; i++) {
            if (i == 8 || i == 12 || i == 16 || i == 20) {
                s = s + "-";
            }
            s = s + parts[i];
        }
        return s;
    }
}
