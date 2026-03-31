# NASA "Power of 10" Rules for C/C++

These are the original 10 rules developed by Gerard Holzmann at NASA JPL for safety-critical software.

1. **Simple Control Flow**: Restrict all code to very simple control flow constructs—do not use goto statements, setjmp or longjmp constructs, or direct or indirect recursion.
2. **Loop Bounds**: All loops must have a fixed upper bound. It must be trivially provable that the loop cannot exceed a preset upper-bound number of iterations.
3. **No Dynamic Memory**: Do not use dynamic memory allocation after initialization. (e.g., no malloc, free, new, delete after startup).
4. **Short Functions**: No function should be longer than what can be printed on a single sheet of paper in a standard format with one line per statement and one line per declaration (typically 60 lines of code).
5. **Assertions**: The assertion density of the code should average to a minimum of two assertions per function. Assertions are used to check for anomalous conditions that should never happen in real-life executions.
6. **Smallest Scope**: Declare all data objects at the smallest possible level of scope.
7. **Return Values & Parameters**: Each calling function must check the return value of non-void functions, and each called function must check the validity of all parameters provided by the caller.
8. **Limited Preprocessor**: The use of the preprocessor must be limited to the inclusion of header files and simple macro definitions. Token pasting, variable argument lists, and recursive macro calls are not allowed.
9. **Limited Pointers**: The use of pointers should be restricted. Specifically, no more than one level of dereferencing is allowed. Pointer dereferencing operations may not be hidden in macro definitions or inside typedef declarations. Function pointers are not permitted.
10. **Compile Warnings**: All code must be compiled, from the first day of development, with all compiler warnings enabled at the compiler's most pedantic setting. All code must compile with these settings without any warnings.
