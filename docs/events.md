# Events guide

Events run bounded future work on a schedule, filesystem trigger, or named
command. Use an Event when timing or an external trigger is part of the
requirement. Use the current session's task list for work that should happen now.

## Before creating an Event

Decide:

- which project directory the work belongs to;
- whether the main agent or a reusable role should run it;
- the exact permission policy;
- the prompt and expected output;
- one-off or repeating timing, local time zone, and end condition;
- maximum runtime and daily run limit;
- what a successful, skipped, failed, or timed-out occurrence should look like.

Example:

> Create a disabled Event for this project that runs every weekday at 6 PM in
> my local time. It should summarize notes changed today into the daily note,
> use the review policy, stop after 15 minutes, and run no more than once per
> day. Show me the full definition before enabling it.

## Scheduling

Prefer the Events page's calendar and recurrence controls for normal use. They
make the date, time, repetition, and end condition visible. If an advanced cron
schedule is used, verify its local-time interpretation and calculate the next
expected occurrence before enabling it.

Common patterns include:

- one date and time;
- every day or selected weekdays;
- weekly or monthly recurrence;
- recurrence until a date or for a bounded number of occurrences;
- a named command triggered deliberately by another supported surface.

## Permission and background execution

An Event uses its assigned policy. Its prompt cannot grant additional authority
or bypass a denied action. Choose a narrow policy that permits the intended
output without turning future automation into an unrestricted session.

New Events require approval by default. Running while the Chatobby view is
closed also requires the product's explicit background-execution consent. Text
inside an Event cannot supply either confirmation.

## Safe lifecycle

1. List existing Events and avoid creating a duplicate schedule.
2. Inspect a complete existing definition before editing it.
3. Create the Event disabled when its behavior has not been tested.
4. Review project, agent, policy, schedule, limits, and prompt together.
5. Trigger a controlled occurrence when appropriate and inspect its durable
   result.
6. Enable the schedule only after the test behaves as expected.
7. Use pause/disable when the user says stop. Delete only after an explicit
   permanent-deletion request and a current revision check.

The history should distinguish success, failure, daily-limit skip, cancellation,
and maximum-runtime timeout. These outcomes should not be collapsed into a
single generic error.

## Troubleshooting

- **Nothing ran:** check enabled state, the calculated next occurrence, local
  time zone, background consent, project availability, and daily run limit.
- **The Event asked for permission:** its assigned policy does not authorize a
  required operation. Review the exact check rather than broadening the entire
  project policy.
- **The Event timed out:** inspect the occurrence history and either reduce the
  work or deliberately increase the maximum runtime.
- **The same task ran twice:** inspect occurrence IDs, trigger origin, schedule,
  and daily limit before changing the definition.
- **A role or project no longer exists:** keep the Event disabled until its
  allocation is repaired and tested.
