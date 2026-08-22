# v1.7 Product Notes — Creative + Smarter Tasks

## Drawing architecture

Togetherly stores drawings as normalized vector-like strokes (`0..1000` coordinates) rather than screenshots. This makes one drawing usable at both a full canvas size and a tiny icon size, avoids image-upload overhead for simple doodles, and keeps the format reusable.

Initial surfaces:

- **Draw Together:** shared realtime game canvas.
- **Tag custom icon:** replace the stock/emoji icon with a hand-drawn mark. Because Tags appear across most content types, this immediately brings custom drawings into Tasks, Lists, Notes, Calendar, Goals, Trips, Activities and Memories.

Possible later surfaces can reuse the same format: Doodle Guess, shared doodle notes, Memory sketches, custom List/Goal/Album icons.

## Task timing model

A Task now has three independent planning concepts:

- **Due date:** final deadline.
- **Start / Needs Attention:** explicit date when work should begin.
- **Estimated duration:** how much preparation/work the Task is expected to require.

If Start is blank but Due + Duration exist, Home derives a practical attention date. This keeps data entry optional while still making long-lead work visible before its final deadline.

Each checklist step can independently have a due date and estimated duration. This supports projects where the event/final Task happens later but a prerequisite—such as booking a reservation—must happen earlier.
