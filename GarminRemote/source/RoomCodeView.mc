import Toybox.WatchUi;
import Toybox.Graphics;
import Toybox.System;

// Displays a room code entry prompt and the currently typed code.
// The user scrolls UP/DOWN to cycle through characters and presses
// START to confirm each character. After 4 characters, START advances
// to the RemoteView.
class RoomCodeView extends WatchUi.View {

    const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const CODE_LENGTH = 4;

    var _chars;       // Array of current character indices
    var _cursor;      // Which character position is being edited

    function initialize() {
        View.initialize();
        _cursor = 0;
        _chars = new [CODE_LENGTH];

        // Pre-fill with last used code if available
        var saved = Storage.loadRoomCode();
        if (saved != null && saved.length() == CODE_LENGTH) {
            for (var i = 0; i < CODE_LENGTH; i++) {
                var c = saved.substring(i, i + 1);
                var idx = ALPHABET.find(c);
                _chars[i] = (idx != null) ? idx : 0;
            }
        } else {
            for (var i = 0; i < CODE_LENGTH; i++) {
                _chars[i] = 0;
            }
        }
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.15, Graphics.FONT_SMALL, "Enter Room Code", Graphics.TEXT_JUSTIFY_CENTER);

        // Draw each character; highlight the active cursor position
        var codeStr = getCodeString();
        for (var i = 0; i < CODE_LENGTH; i++) {
            var x = w * (0.2 + i * 0.2);
            var color = (i == _cursor) ? Graphics.COLOR_YELLOW : Graphics.COLOR_WHITE;
            dc.setColor(color, Graphics.COLOR_TRANSPARENT);
            dc.drawText(x, h * 0.4, Graphics.FONT_NUMBER_MEDIUM,
                        codeStr.substring(i, i + 1), Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.72, Graphics.FONT_TINY, "UP/DOWN: change", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(w / 2, h * 0.82, Graphics.FONT_TINY, "START: confirm", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function getCodeString() {
        var s = "";
        for (var i = 0; i < CODE_LENGTH; i++) {
            s = s + ALPHABET.substring(_chars[i], _chars[i] + 1);
        }
        return s;
    }

    function incrementChar() {
        _chars[_cursor] = (_chars[_cursor] + 1) % ALPHABET.length();
        WatchUi.requestUpdate();
    }

    function decrementChar() {
        _chars[_cursor] = (_chars[_cursor] - 1 + ALPHABET.length()) % ALPHABET.length();
        WatchUi.requestUpdate();
    }

    // Advances the cursor. Returns true when all 4 characters are confirmed.
    function confirmChar() {
        _cursor++;
        if (_cursor >= CODE_LENGTH) {
            return true;
        }
        WatchUi.requestUpdate();
        return false;
    }

    function getCode() {
        return getCodeString();
    }
}

class RoomCodeDelegate extends WatchUi.BehaviorDelegate {

    var _view;

    function initialize(view) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    // UP button — next character
    function onNextPage() {
        _view.incrementChar();
        return true;
    }

    // DOWN button — previous character
    function onPreviousPage() {
        _view.decrementChar();
        return true;
    }

    // START button — confirm current character
    function onSelect() {
        var done = _view.confirmChar();
        if (done) {
            var code = _view.getCode();
            Storage.saveRoomCode(code);
            WatchUi.switchToView(
                new RemoteView(code),
                new RemoteDelegate(code),
                WatchUi.SLIDE_LEFT
            );
        }
        return true;
    }
}
