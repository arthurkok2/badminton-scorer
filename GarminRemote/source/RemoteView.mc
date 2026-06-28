import Toybox.WatchUi;
import Toybox.Graphics;
import Toybox.Attention;

// The active remote screen. Shows the room code and the three scoring actions.
//
// Button mapping (Forerunner 265):
//   UP   (top-right)    → Team A point
//   DOWN (bottom-right) → Team B point
//   BACK (top-left)     — hold to undo (short press goes back to code entry)
//   START               → reserved
//
// A pending indicator is shown while an HTTP request is in flight.
// Success triggers a short vibration. Failure shows an error message.

enum {
    STATE_IDLE,
    STATE_PENDING,
    STATE_ERROR
}

class RemoteView extends WatchUi.View {

    var _roomCode;
    var _state;
    var _errorMsg;

    function initialize(roomCode) {
        View.initialize();
        _roomCode = roomCode;
        _state = STATE_IDLE;
        _errorMsg = "";
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();

        // Room code
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.05, Graphics.FONT_TINY, "Room: " + _roomCode,
                    Graphics.TEXT_JUSTIFY_CENTER);

        if (_state == STATE_PENDING) {
            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.45, Graphics.FONT_MEDIUM, "Sending...",
                        Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        if (_state == STATE_ERROR) {
            dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.38, Graphics.FONT_SMALL, "Error",
                        Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.52, Graphics.FONT_TINY, _errorMsg,
                        Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(w / 2, h * 0.68, Graphics.FONT_TINY, "Press any button",
                        Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        // Idle — show button labels
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.22, Graphics.FONT_SMALL, "UP: Team A",
                    Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.44, Graphics.FONT_TINY, "Hold BACK: Undo",
                    Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.62, Graphics.FONT_SMALL, "DOWN: Team B",
                    Graphics.TEXT_JUSTIFY_CENTER);
    }

    function setPending() {
        _state = STATE_PENDING;
        WatchUi.requestUpdate();
    }

    function setSuccess() {
        _state = STATE_IDLE;
        vibrateShort();
        WatchUi.requestUpdate();
    }

    function setError(msg) {
        _state = STATE_ERROR;
        _errorMsg = msg;
        WatchUi.requestUpdate();
    }

    function clearError() {
        _state = STATE_IDLE;
        WatchUi.requestUpdate();
    }

    function vibrateShort() {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(50, 120)]);
        }
    }
}

class RemoteDelegate extends WatchUi.BehaviorDelegate {

    var _roomCode;
    var _view;
    var _sourceId;

    function initialize(roomCode) {
        BehaviorDelegate.initialize();
        _roomCode = roomCode;
        _sourceId = Storage.getSourceId();
    }

    // Called by WatchUi after the view is pushed — store the view reference.
    function onShow() {
        // WatchUi doesn't give us the view directly; we retrieve it via the stack.
        // Instead we pass the view in from the push site below.
    }

    // UP button — Team A point
    function onNextPage() {
        sendCommand("teamA");
        return true;
    }

    // DOWN button — Team B point
    function onPreviousPage() {
        sendCommand("teamB");
        return true;
    }

    // BACK short press — return to code entry (change room)
    function onBack() {
        WatchUi.switchToView(
            new RoomCodeView(),
            new RoomCodeDelegate(new RoomCodeView()),
            WatchUi.SLIDE_RIGHT
        );
        return true;
    }

    // BACK long press — Undo
    function onMenu() {
        sendUndo();
        return true;
    }

    function sendCommand(teamId) {
        var view = getCurrentView();
        if (view == null) { return; }
        if (view._state == STATE_PENDING) { return; }
        if (view._state == STATE_ERROR) { view.clearError(); return; }

        view.setPending();
        FirestoreClient.sendPoint(_roomCode, teamId, _sourceId,
            method(:onResponse));
    }

    function sendUndo() {
        var view = getCurrentView();
        if (view == null) { return; }
        if (view._state == STATE_PENDING) { return; }
        if (view._state == STATE_ERROR) { view.clearError(); return; }

        view.setPending();
        FirestoreClient.sendUndo(_roomCode, _sourceId,
            method(:onResponse));
    }

    function onResponse(responseCode, data) {
        var view = getCurrentView();
        if (view == null) { return; }

        // Firestore REST returns 200 on successful document creation
        if (responseCode == 200) {
            view.setSuccess();
        } else {
            view.setError("HTTP " + responseCode.toString());
        }
    }

    // Returns the current RemoteView from the WatchUi stack, or null.
    function getCurrentView() {
        var viewStack = WatchUi.getCurrentView();
        if (viewStack != null && viewStack[0] instanceof RemoteView) {
            return viewStack[0] as RemoteView;
        }
        return null;
    }
}
