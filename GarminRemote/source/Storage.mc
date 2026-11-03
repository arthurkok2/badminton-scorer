import Toybox.Application;
import Toybox.Math;

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

    // Generates a pseudo-random UUID v4 string using Math.rand().
    function generateUuid() {
        var hex = "0123456789abcdef";
        var s = "";
        for (var i = 0; i < 32; i++) {
            if (i == 8 || i == 12 || i == 16 || i == 20) {
                s = s + "-";
            }
            var r = Math.rand() % 16;
            if (r < 0) { r = r + 16; }
            s = s + hex.substring(r, r + 1);
        }
        return s;
    }
}
