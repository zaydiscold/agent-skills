# NASA "Power of 10" Adapted Rules for Interpreted/Modern Languages

These are adaptations of the original 10 NASA JPL rules, translated for languages like Python, JavaScript, TypeScript, Go, Ruby, etc.

1. **Simple Control Flow**: No goto equivalents; no recursion; avoid unstructured fall-through switches.
2. **Loop Bounds**: All iteration must be provably bounded. Do not use unbounded `while (true)` without explicit timeout or iteration counters.
3. **Bounded Memory**: Memory usage must be bounded. Use pagination, chunking, parsing streams instead of buffering massive datasets in memory dynamically.
4. **Short Functions**: Functions must not exceed 60 lines of code. Keep logic highly cohesive.
5. **Fail Loudly**: Rely on assertions and exceptions. Never silently swallow errors in empty catch blocks. If an anomalous condition occurs, the system should halt or bubble the exception up.
6. **Smallest Scope**: Declare variables in the smallest possible scope. Avoid globals entirely. Do not leak variables across block scopes.
7. **Check Everything**: Never silently discard errors or return values from critical functions. Always handle boundary conditions and validate inputs.
8. **Minimal Build Complexity**: Minimize transpiler/build/bundler complexity. Don't rely on magic macros, hidden codegen, or overly complex pre-flight logic that obscures the final code.
9. **Immutable Arguments & Type Safety**: Do not mutate function arguments. Treat data flowing into a function as strictly read-only. Use all available type-safety features of the language (e.g., TypeScript strict mode, Python type hints).
10. **Zero Warnings**: Use all available linters and static analyzers (e.g., ESLint, PyLint) set to the strictest settings. Produce zero warnings.
