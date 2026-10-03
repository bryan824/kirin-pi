# Logic Prototype

Use for uncertain business rules, state transitions, data shapes or API behavior.
The question decides the interface: a small assertion-driven script may be enough;
a terminal loop can help someone explore transitions; an offline page may be
better for a recipient who cannot run the project. Do not build a UI merely
because the artifact is called a prototype. Visual questions use [UI.md](UI.md).

## Keep the useful part portable

Put the decision-rich logic behind a small interface independent of presentation
and incidental I/O. A reducer, transition function, transformation or state-owning
module can all work. It can live in the same file as the shell; extra files and
abstractions are not a requirement. Substitute approved fixtures for effects that
are not themselves the question.

Show the initial state, allowed actions and resulting state. Make edge cases
reachable deliberately: invalid input, cancellation, repeated actions, empty or
conflicting state, and failure recovery where relevant. Add a reset and name the
scenario/input so another person can reproduce the observation. A terminal view
should stay understandable without unreadable scrollback; no styling library is
needed for a useful state trace.

## Keep the experiment safe and decisive

Use the host runtime and existing tooling. Provide one run command; add task-runner
wiring only when it helps the recipient rather than creating a permanent shim.
Keep secrets out of fixtures and logs. Do not wire to a real database by default.
If persistence is the uncertainty, use isolated approved data, clear destination
ownership and a recovery plan, not production credentials or destructive writes.

Leave the smallest runnable check that can refute the proposed rule: independent
expected output, an invariant, or a worked example across the important boundary.
Do not import a test framework merely for the experiment. Preserve validation and
error handling where failure would hide the answer or harm data. An unavailable
real integration remains unverified even when a substitute behaves well.

Give the recipient controls and scenarios, capture observed results, and ask for
choices that depend on their judgment. Reuse the task's working notes; do not manufacture
a verdict or a new ADR when no decision has been made. Promote portable logic only
after production review and tests, within implementation authority. Cleanup covers
only authorized throwaway files, not user work or existing records.
