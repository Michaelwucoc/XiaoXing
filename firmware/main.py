# Xiaoxing Delivery / micro:bit USB controller (protocol version 2)
# MicroPython; uses only features shared by micro:bit V1 and V2.
# Tilt = move one step (hold to repeat slowly), A = hint / OK, B = undo.
# The position at power-on counts as "neutral". Press A+B together, or use
# the game's calibrate button, to re-centre.
#
# Board -> game:  ORBIT|M|up|down|left|right   ORBIT|A   ORBIT|B
#                 ORBIT|V|2 (version)   ORBIT|K (calibrated)   ORBIT|T|x,y (live tilt)
# Game -> board:  ORBIT|?  ORBIT|C  ORBIT|S|<mg>  ORBIT|T|1 / ORBIT|T|0
from microbit import (
    accelerometer, button_a, button_b, display, Image, sleep,
    running_time, uart
)

VERSION = "2"
uart.init(baudrate=115200)
ARROWS = {
    "up": Image.ARROW_N,
    "down": Image.ARROW_S,
    "left": Image.ARROW_W,
    "right": Image.ARROW_E,
}
threshold = 380      # mg away from neutral before a tilt counts
FIRST_REPEAT = 650   # ms before a held tilt repeats
REPEAT = 450         # ms between repeated steps


def send(text):
    uart.write("ORBIT|" + text + "\n")


def calibrate():
    display.show(Image.DIAMOND_SMALL)
    sx = 0
    sy = 0
    for _ in range(16):
        sx += accelerometer.get_x()
        sy += accelerometer.get_y()
        sleep(25)
    display.show(Image.SQUARE_SMALL)
    send("K")
    return sx // 16, sy // 16


def handle(line):
    global base_x, base_y, threshold, stream, direction
    if line == "ORBIT|?":
        send("V|" + VERSION)
    elif line == "ORBIT|C":
        base_x, base_y = calibrate()
        direction = None
    elif line.startswith("ORBIT|S|"):
        try:
            value = int(line[8:])
            if 150 <= value <= 900:
                threshold = value
        except ValueError:
            pass
    elif line == "ORBIT|T|1":
        stream = True
    elif line == "ORBIT|T|0":
        stream = False


display.show(Image.HAPPY)
sleep(400)
base_x, base_y = calibrate()
send("V|" + VERSION)
direction = None
next_send = 0
next_tilt = 0
stream = False
inbox = ""

while True:
    now = running_time()

    if uart.any():
        data = uart.read()
        if data:
            try:
                inbox += str(data, "utf-8")
            except Exception:
                inbox = ""
            while "\n" in inbox:
                line, inbox = inbox.split("\n", 1)
                handle(line.strip())
            if len(inbox) > 64:
                inbox = ""

    if button_a.is_pressed() and button_b.is_pressed():
        sleep(300)
        base_x, base_y = calibrate()
        button_a.was_pressed()
        button_b.was_pressed()
        direction = None
        continue

    x = accelerometer.get_x() - base_x
    y = accelerometer.get_y() - base_y
    if stream and now >= next_tilt:
        send("T|" + str(x) + "," + str(y))
        next_tilt = now + 100

    strength = max(abs(x), abs(y))
    new = None
    if strength >= threshold:
        if abs(x) >= abs(y):
            new = "right" if x > 0 else "left"
        else:
            new = "down" if y > 0 else "up"
    elif direction and strength >= threshold * 6 // 10:
        new = direction  # small wobble keeps the current direction

    if new != direction:
        direction = new
        display.show(ARROWS[new] if new else Image.SQUARE_SMALL)
        if new:
            send("M|" + new)
            next_send = now + FIRST_REPEAT
    elif direction and now >= next_send:
        send("M|" + direction)
        next_send = now + REPEAT

    if button_a.was_pressed():
        send("A")
    if button_b.was_pressed():
        send("B")
    sleep(30)
