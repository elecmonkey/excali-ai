/**
 * Mermaid syntax guide for AI tool descriptions
 * This content is embedded in tool descriptions and automatically sent to LLM
 */

export const MERMAID_SYNTAX_GUIDE = `
SUPPORTED DIAGRAM TYPES:
- flowchart/graph: Flow diagrams
- sequenceDiagram: Sequence diagrams  
- classDiagram: Class diagrams
- stateDiagram: State diagrams
- erDiagram: Entity relationship diagrams
- pie: Pie charts
- gantt: Gantt charts

CRITICAL SYNTAX RULES BY DIAGRAM TYPE:

1. flowchart/graph:
   ✅ Labels with special chars MUST use quotes: A["Object.prototype"]
   ✅ Decision nodes: B{"is null?"}
   ✅ Arrow labels: A -->|"label"| B
   ❌ WRONG: A[Function()] without quotes

2. classDiagram (STRICTEST):
   ✅ Inheritance: ParentClass <|-- ChildClass
   ✅ Association: ClassA --> ClassB (NO label allowed)
   ✅ Methods: +methodName() (NO type annotation)
   ❌ FORBIDDEN: "extends" keyword
   ❌ FORBIDDEN: --o>, o--, <o-- (ER symbols)
   ❌ FORBIDDEN: --> : label (arrow labels)
   ❌ FORBIDDEN: +String method() (type annotations)
   
   Example:
   classDiagram
     class Animal {
       +name
       +eat()
     }
     class Dog {
       +bark()
     }
     Animal <|-- Dog

3. erDiagram:
   ✅ Relationships: ENTITY ||--o{ OTHER : "relationship"
   ❌ Do NOT use <|-- (that's for classDiagram)

4. sequenceDiagram:
   ✅ Participants: participant Alice
   ✅ Messages: Alice->>Bob: "Hello"
   ✅ Activations: activate Alice

5. stateDiagram:
   ✅ States: [*] --> State1
   ✅ Transitions: State1 --> State2: "event"

SPECIAL CHARACTERS requiring quotes: [ ] ( ) { } | < > # & ;

When parse error occurs, the error message will include DIAGNOSTIC hints - follow them to fix the syntax.`;
