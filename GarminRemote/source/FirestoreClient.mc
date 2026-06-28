import Toybox.Communications;
import Toybox.Time;
import Toybox.Time.Gregorian;

// Sends commands to Firestore via the REST API.
// Requests are routed through the Garmin Connect app on the paired phone.
//
// Firestore project: badminton-scorer-91f7d
// Collection path:   matches/{code}/commands
// Auth:              unauthenticated (rules allow command creation without auth)
//                    See: .specs/2026/06/2026-06-24-garmin-connect-iq-remote.md
module FirestoreClient {

    const PROJECT_ID = "badminton-scorer-91f7d";
    const API_KEY = "AIzaSyD-Y-VmelbcTKMyTRrXfZ5fJEjVlRoatP4";

    // Sends a POINT_TEAM command for the given team ("teamA" or "teamB").
    function sendPoint(roomCode, teamId, sourceId, callback) {
        var fields = buildBaseFields(sourceId);
        fields["type"] = { "stringValue" => "POINT_TEAM" };
        fields["teamId"] = { "stringValue" => teamId };
        post(roomCode, fields, callback);
    }

    // Sends an UNDO command.
    function sendUndo(roomCode, sourceId, callback) {
        var fields = buildBaseFields(sourceId);
        fields["type"] = { "stringValue" => "UNDO" };
        post(roomCode, fields, callback);
    }

    // Builds the fields common to every command document.
    function buildBaseFields(sourceId) {
        return {
            "sourceId"   => { "stringValue" => sourceId },
            "sourceKind" => { "stringValue" => "garmin" },
            "createdAt"  => { "timestampValue" => currentTimestamp() }
        };
    }

    // POSTs a new command document to Firestore.
    function post(roomCode, fields, callback) {
        var url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID
                + "/databases/(default)/documents/matches/" + roomCode
                + "/commands?key=" + API_KEY;

        var body = { "fields" => fields };

        var options = {
            :method       => Communications.HTTP_REQUEST_METHOD_POST,
            :headers      => { "Content-Type" => "application/json" },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };

        Communications.makeWebRequest(url, body, options, callback);
    }

    // Returns an RFC3339 UTC timestamp string for the current time.
    function currentTimestamp() {
        var now = Time.now();
        var info = Gregorian.info(now, Time.FORMAT_SHORT);
        return info.year.format("%04d") + "-"
             + info.month.format("%02d") + "-"
             + info.day.format("%02d") + "T"
             + info.hour.format("%02d") + ":"
             + info.min.format("%02d") + ":"
             + info.sec.format("%02d") + ".000Z";
    }
}
