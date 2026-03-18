# **The Emergence of ASCII-First Architecture: Redefining the Synthesis of Design, Specification, and Execution in AI-Driven Software Engineering**

The historical trajectory of software engineering has been characterized by an increasing abstraction away from the underlying machine state. From assembly language to high-level imperative programming, and eventually to the declarative frameworks of the modern web, each leap has sought to bridge the gap between human intent and machine execution. However, the advent of Large Language Models (LLMs) and autonomous AI agents has introduced a new challenge: the "hallucination gap" between visual design and functional code. ASCII-First Architecture emerges as a revolutionary paradigm that solves this discrepancy by utilizing plain text as the primary medium for both the specification and the running application. This architectural shift recognizes that text-native visual formats, such as ASCII art, encode two-dimensional spatial structures using one-dimensional character sequences, making them an ideal "isomorphic middle ground" for LLM cognition and human verification.1

## **The Theoretical Framework of Symbolic Visual Expression**

At the heart of the ASCII-First movement is the concept of Symbolic Visual Expression (SVE). Traditional computer vision models process images as pixel tensors, which, while effective for classification, often lack the semantic grounding required for complex structural reasoning within a text-based reasoning engine like a transformer. SVE-ASCII is a unified framework designed to elicit and benchmark this latent capacity within pure text space.1 Research indicates that LLMs possess a native capacity for visual expression that does not require external rendering engines, provided the visual data is presented in a format that respects the model's tokenization and attention mechanisms.1

The development of the ASCIIArt-7K dataset and the accompanying ASCIIArt-Bench has provided the empirical evidence needed to validate this approach. By utilizing a "Seed-and-Evolve" pipeline—where human-curated anchors are augmented through in-context stylistic editing—researchers have constructed a high-quality corpus that forces models to attend to fine-grained spatial details.1 This process creates a "Cycle of Mutual Reinforcement," where the rigor required to generate coherent ASCII structures improves the model's ability to interpret and classify visual inputs.1 In the context of software architecture, this means an agent trained on SVE can "visualize" a dashboard layout with the same precision that a human developer might use a grid-based design tool.

| Attribute | Symbolic Visual Expression (SVE) | Traditional Graphical Rendering |
| :---- | :---- | :---- |
| **Data Format** | 1D Character Stream (ASCII/Unicode) | 2D/3D Pixel Tensors |
| **Cognitive Load** | Low (Semantic tokens) | High (Raw pixel data) |
| **Execution** | Immediate (Text interpretation) | Delayed (Compilation/Rendering) |
| **Portability** | Universal (Terminal, Web, IoT) | Platform-specific (Drivers, GPUs) |
| **AI Alignment** | Native to LLM training data | Requires multimodal alignment |

The implications of SVE for software development are profound. When an AI designs a user management screen or a system metrics dashboard in ASCII, it is not merely creating a mockup; it is establishing a spatial coordinate system where every character—a bracket, a button label, a status indicator—becomes a discrete, addressable object in the application’s state machine.

## **ASCII as Architectural Plan: The Unified Specification**

In traditional development, a designer creates a mockup in a tool like Figma, which a developer then translates into React or SwiftUI code. This translation is a primary source of technical debt and functional errors. ASCII-First Architecture collapses these steps into a single event: the ASCII design IS the application.1

## **The Grid-Based Coordinate System**

The architectural plan relies on a sophisticated grid system that translates logical positions into character points. Drawing from interactive dependency graph research, such as that seen in the Spack package management system, the transformation of a logical layout to an ASCII grid requires precise mapping algorithms.3 These algorithms often use expansion functions, such as a 2x multiplier for row and column spacing, to prevent the layout from becoming too dense for human or machine readability.3

In this environment, a button labeled \[A\] List is not just a string of characters at a specific coordinate; it is a vertex in the application's interactive DAG (Directed Acyclic Graph). The use of box-drawing characters (e.g., ┌, ─, ┐, │) provides structural boundaries that the AI and the runtime server can use to identify container scopes.3 This structural meaning is preserved throughout the application lifecycle, allowing for a "what-you-type-is-what-you-see" synthesis that eliminates the misalignment between symbolic syntax and visual semantics.1

## **Interaction Logic and Bindings.json**

While the ASCII provides the visual structure, the behavior of the application is governed by a metadata layer: the bindings.json. This file defines the mapping between specific ASCII patterns and backend operations. The A2A (Agent-to-Agent) specification highlights the necessity of such protocol bindings to ensure that core semantics remain consistent across different interaction modalities, such as JSON-RPC, gRPC, or REST.4

The bindings.json serves as the authoritative source for how the application responds to user input. For example, a binding might specify that any keypress of "A" within a certain view triggers a list\_users operation. This structure mirrors the Universal Authentication Framework (UAF) protocol, which allows services to select specific mechanisms presented to the user based on registered capabilities.5 By decoupling the visual label from the action, the AI can iterate on the UI (e.g., moving the \[A\] button) without breaking the underlying logic, provided the binding remains associated with the intended label.

JSON

{  
  "view\_id": "main\_dashboard",  
  "bindings":,  
  "state\_transitions": {  
    "HOME": { "A": "OVERVIEW\_VIEW", "B": "CPU\_DETAIL" },  
    "OVERVIEW\_VIEW": { "X": "HOME" }  
  }  
}

This layered approach—Visual (ASCII), Logic (Bindings), and Data (State)—ensures that the application is both human-readable and machine-executable. It allows developers to reason about A2A operations independently of binding concerns, maintaining interoperability through a shared understanding of the canonical data model.4

## **The Mechanics of AI Building with ASCII-First**

The workflow for an AI agent operating within this architecture is fundamentally different from traditional coding agents that output boilerplate React or CSS.

## **Step 1: Spatial Design via Prompting**

When a user requests a new feature, the AI does not begin by writing a component library. Instead, it generates a text-based visual layout. This phase exploits the LLM's spatial reasoning abilities, which are sharpened by datasets like ASCIIArt-7K.1 The model creates a layout that fits within standard terminal bounds (typically 80x24 characters), ensuring that it adheres to universal constraints that have existed since the inception of the American Standard Code for Information Interchange (ASCII) in the 1960s.7

This design phase is incredibly token-efficient. A complex metrics dashboard that might require 2,000 tokens of HTML and Tailwind CSS can be represented in 200 tokens of ASCII. This efficiency allows the AI to maintain a much larger context window, enabling it to track more complex state transitions and multi-step workflows without hitting the "forgetting" thresholds of modern transformers.8

## **Step 2: Defining Interaction Modalities**

Once the layout is established, the AI generates the corresponding JSON metadata. This metadata defines "Agent Cards," which describe the capabilities, skills, and authentication requirements of the interface.4 These cards allow different agents to discover and interact with the application, negotiating modalities like text, files, or structured data.4 This level of abstraction is critical for long-running tasks and interactions that may involve human-in-the-loop scenarios, as it provides a clear, inspectable contract for behavior.4

## **Step 3: Immediate Execution and Refinement**

Because the ASCII and the bindings constitute a working application, there is no "compile" or "bundle" step. The application "runs" as soon as the text is generated. A lightweight ascii-server parses the layout and the JSON, rendering the view to the user’s terminal or a web-based text emulator. The feedback loop is instantaneous: the user sees the result, provides feedback ("Move the search bar to the top"), and the AI updates the ASCII string. This eliminates the "perceptual bottlenecks" that occur when text flattens 2D structure into 1D code, as the design itself remains a 2D spatial representation.8

## **Comparative Analysis of Development Models**

The transition to ASCII-First Architecture offers significant advantages over traditional frontend-heavy development models, particularly for AI agents that struggle with the high-dimensional complexity of CSS and modern framework dependencies.

| Feature | Traditional Frontend (React/CSS) | ASCII-First Architecture |
| :---- | :---- | :---- |
| **Development Cycle** | Design \-\> Code \-\> Compile \-\> Render | Design \-\> Run |
| **Logic/View Coupling** | High (Intertwined in JS/JSX) | Low (ASCII vs. JSON Bindings) |
| **Agent Accuracy** | Low (Frequent visual hallucinations) | High (Precise spatial coordinates) |
| **Technical Debt** | High (Framework churn, CSS bloat) | Low (Stable text standards) |
| **Observability** | Requires browser/devtools | Inspectable in any text editor |
| **Serialization** | Complex (DOM trees) | Simple (String arrays) 10 |

The "hallucination gap" is particularly poignant in traditional development. An AI might generate a beautiful React component with nested flexboxes that, when rendered, results in a button being hidden behind another element due to a z-index error. In ASCII-First, a button is at a specific character row and column; there is no hidden state. If the character is there, the button is there. This semantic precision is the "killer feature" that makes the architecture powerful for autonomous agents.

## **ASCII as a GUI Renderer Target: The Path to Aesthetic Richness**

One might argue that ASCII is too primitive for modern user expectations. However, in this architecture, ASCII is not the *final* output for all users; it is the *source of truth*. A secondary layer, the GUI Renderer, can take the same ASCII and bindings.json and transform them into a high-fidelity interface.1

## **The Rendering Pipeline**

The rendering pipeline functions as a sophisticated parser. Using libraries like those found in the Rust ecosystem for encoding and serialization (e.g., serde\_json, wasm-bindgen), the renderer identifies patterns in the ASCII layout.10

1. **Border Identification**: Sequences of ┌─┐ and │ are converted into container components (divs, cards, or windows).  
2. **Interactive Elements**: Brackets like \[A\] are identified as button components. The renderer uses the bindings.json to attach event listeners and appropriate labels.  
3. **Dynamic Placeholders**: Tokens like ● or ○ are replaced with animated status icons, while progress bars like ███░░ are replaced with SVG-based progress components.  
4. **Text Rendering**: Labels and data fields are extracted and placed within the rich UI components, often using high-quality typography that maintains the alignment suggested by the original ASCII grid.

This approach ensures that the "beautiful" version of the app is always functional. If the GUI fails to load or has a rendering bug, the application remains perfectly usable in its native ASCII form. This mirrors the robustness of terminal-based interactive tools like the Spack dependency visualizer, which participants in research studies preferred for their ability to integrate directly into command-line workflows.3

## **Universal Compatibility and WASM Integration**

The same ASCII template can target multiple renderers—Electron for desktop, React Native for mobile, or simple HTML for the web. This is made possible by the standardization of text encoding.7 By sticking to the Unicode standard, which can represent over 140,000 characters from all modern and historic scripts, the architecture remains globally compatible and future-proof.7

Performance is maintained through the use of WebAssembly (Wasm). Wasm runtimes like wasmtime and bindings generators like wit-bindgen allow the ASCII-to-GUI rendering logic to run at near-native speeds within the browser or on the server.12 This allows for complex, real-time data visualizations (like those used in system metrics dashboards) to be served with minimal latency, even when the underlying data is being processed by high-level Rust logic.12

## **Deep Dive: How AI Agents Coordinate Using ASCII-First**

The power of this architecture is amplified when multiple agents collaborate. In a traditional environment, managing multiple coding agents (e.g., Claude for architecture, Codex for implementation, Gemini for testing) is challenging, as they must sync across different files and terminal windows.

## **Multi-Agent Workflows with Tmux and NTM**

The ntm (Named Tmux Sessions) approach facilitates this by providing a single session where all AI agents live in tiled panes.9 In this environment, agents can share ASCII states and broadcast prompts to one another. For example:

* **Architect Agent**: Generates the main.ascii layout and bindings.json.  
* **Implementation Agent**: Watches the bindings.json and writes the underlying logic for the add\_user action.  
* **Testing Agent**: Simulates keypresses (e.g., "B" for add user) and verifies that the ASCII state transitions to the ADD\_FORM view correctly.

This setup includes "context monitoring" and "automatic compaction," which are vital for ensuring that agents do not exceed their token limits during long-running collaborative tasks.9 By working within a unified text-native environment, the agents can detect conflicts—such as when two agents attempt to modify the same coordinate in the ASCII layout—and resolve them through the shared terminal context.9

## **Protocol Operations and Agent Interaction**

The A2A Protocol Operations provide the fundamental capabilities for these agents to communicate.4 Operations like SendMessage, StreamMessage, and GetTask allow agents to negotiate their work in a binding-independent manner.4 When one agent updates the ASCII UI, it sends a message to the other agents, who can then re-parse the layout and adjust their logic accordingly. This ensures that the entire agentic system is always in sync with the visual state of the application.

| A2A Operation | Purpose in ASCII-First Workflow |
| :---- | :---- |
| **GetAgentCard** | Agent A discovers that Agent B can render ASCII templates. |
| **SendMessage** | Agent A sends the latest main.ascii and bindings.json to Agent B. |
| **ListTasks** | A human supervisor reviews the pending UI updates generated by the agents. |
| **CancelTask** | An update is reverted if the human finds the ASCII layout unsatisfactory. |
| **StreamMessage** | Real-time metrics (CPU/MEM) are streamed directly into the ASCII placeholders.4 |

## **Security, Authentication, and Human-in-the-Loop**

As software becomes more autonomous, the need for secure interaction points is critical. The ASCII-First Architecture incorporates security by design through its structured binding layer.

## **FIDO/UAF Mapping to ASCII**

The Universal Authentication Framework (UAF) provides a model for how services can select mechanisms for user authentication.5 In an ASCII interface, these mechanisms are explicitly mapped. For instance, an "Admin Only" section of a dashboard might require a fingerprint \+ PIN action.5 In the ASCII view, the agent can render a prompt: Please authenticate on your device... The backend binding for this action then waits for a successful UAF response before transitioning the state machine to the protected view. This keeps the high-level logic (the UI and the state transition) separate from the low-level security implementation (the UAF authenticator commands).5

## **Verification and Auditability**

Because every turn in the agent-user interaction is recorded as a text-based state change, the entire lifecycle of the software is auditable. The ntm tool supports JSONL logging of all session activity, allowing developers to review exactly how a certain visual element was designed and implemented.9 This is far more transparent than auditing thousands of lines of JavaScript where side effects and asynchronous state changes can obscure the true behavior of the system.

## **Mathematical Precision in ASCII Layouts**

The effectiveness of ASCII-First design is not just qualitative; it is rooted in the mathematical properties of grid-based layouts. Research into "Graph Drawing in ASCII" demonstrates that layered layouts match the tasks and expectations of users more closely than arbitrary graphical layouts.3

## **The Grid Coordinate Algorithm**

Algorithm 3 from the Spack research provides a deterministic way to translate real-world positions to grid points.3 By using a multiplier to prevent density, the system ensures that interactivity is maintained.

![][image1]  
![][image2]  
Where ![][image3] is the expansion factor (e.g., 2.0). This expansion is necessary because ASCII characters have a fixed aspect ratio (usually taller than they are wide), and a 1:1 mapping from a visual coordinate system to a character grid would result in a distorted UI where buttons are too close to labels.3

Once the grid cells are assigned, the system performs "Edge Layout," assigning specific characters (|, \-, /, \\) based on the directionality of the connection between nodes.3 This algorithmic approach allows the AI agent to generate layouts that are mathematically guaranteed to be readable and interactive.

## **Case Study: Building a Cloud Deployment Dashboard**

To illustrate the full power of this architecture, consider an AI tasked with building a cloud deployment dashboard.

**Phase 1: Initial Generation**

The AI agent, informed by the user's request for "Kubernetes cluster monitoring," generates the following layout:

┌─────────────────────────────────────────────────────────────────────────────┐  
│  K8S CLUSTER MANAGER                                        v1.4.2          │  
├─────────────────────────────────────────────────────────────────────────────┤  
│  \[A\] Nodes  Pods  \[C\] Services  Deployments  \[X\] Logout            │  
├─────────────────────────────────────────────────────────────────────────────┤  
│                                                                             │  
│  CLUSTER STATUS: HEALTHY                                                    │  
│  REGION: us-east-1           UPTIME: 142d 06h 12m                           │  
│                                                                             │  
│  NODES (3/3 Ready)                                                          │  
│  ┌───────────────────────────────────────────────────────────────────────┐  │  
│  │  NAME              STATUS    ROLES     VERSION      CPU       MEM     │  │  
│  │  ip-10-0-1-42      Ready     worker    v1.28.2      24%       42%     │  │  
│  │  ip-10-0-1-86      Ready     worker    v1.28.2      18%       38%     │  │  
│  │  ip-10-0-1-12      Ready     control   v1.28.2      12%       15%     │  │  
│  └───────────────────────────────────────────────────────────────────────┘  │  
│                                                                             │  
│  Refresh Data  \[L\] View Events  \[K\] Drain Node                         │  
└─────────────────────────────────────────────────────────────────────────────┘

**Phase 2: Binding Logic**

Simultaneously, the agent generates the bindings.json. It maps the \[K\] Drain Node action to a specific command-line execution (e.g., kubectl drain). The state machine is updated so that if a node is selected (using keys 1-3), the Drain Node action becomes active for that specific node ID.

**Phase 3: Real-time Updates**

As the actual cluster state changes, the ascii-server uses the data sources defined in the JSON to update the percentages (e.g., 24% becomes 26%). The AI agent does not need to re-write the UI; it only needs to provide the mapping between the cluster API and the ASCII coordinates.

**Phase 4: Aesthetic Upgrade**

Weeks later, the team decides they want a rich web interface. They point a React-based ASCII Renderer at the cluster.ascii and bindings.json. The renderer replaces the box-drawing characters with a sleek Tailwind-styled table, converts the percentages into color-coded progress bars, and adds a "pulsing" green light icon where the Ready text appeared. The core logic and layout remain identical to what the AI originally designed in 30 seconds.

## **Cognitive Linguistics and Perceptual Bottlenecks**

A vital insight from recent research into ARC-AGI benchmarks is that the modality of an encoding (ASCII, JSON, or images) shapes which features are reliably perceived by transformer models.8 While images preserve layout, they can introduce "patch-size aliasing" where the model fails to see fine-grained relationships between pixels.8 Text, while flattening structure, allows for precise coordinate-based reasoning on sparse features.8

ASCII-First Architecture hits the "Goldilocks zone" of perception. It provides the spatial structure of an image with the semantic precision of text. This minimizes the risk of the model "misinterpreting" its own design. When an LLM looks at its ASCII output, it sees a grid of tokens that it can address with mathematical certainty, unlike a raw image where it might struggle to locate the exact center of a button.

| Modality | Structural Perception | Execution Precision | Agentic Compatibility |
| :---- | :---- | :---- | :---- |
| **Pure Image** | High (2D shapes) | Low (Aliasing/Resolution) | Low (Requires vision-encoder) |
| **JSON Only** | Low (Implicit structure) | High (Data integrity) | Medium (Hard to "visualize") |
| **ASCII-First** | High (Grid-based 2D) | High (Token-aligned) | High (Native to LLM training) |

## **The Impact on Technical Debt and Maintenance**

In the traditional software lifecycle, the frontend is often the most volatile component. Frameworks like Angular, React, and Vue change rapidly, and the CSS ecosystem is prone to "bloat" as projects grow. ASCII-First Architecture offers a path to "unhistorical Classicism"—a style characterized by simplification and a formal language of tensely related, simple forms resolved into compelling unities.13

By grounding the application in ASCII, the project inherits the stability of a standard that has remained largely unchanged since the 1960s.7 The "logic-first" nature of the architecture means that the core value of the software—the interaction flow and state management—is not tied to any specific GUI library. If React is replaced by a new framework in five years, only the "renderer" needs to be updated. The application itself, defined as ASCII and JSON, remains perfectly valid.

This decoupling also benefits testing. Instead of brittle Selenium or Cypress tests that break when a CSS class name changes, ASCII-First applications are tested via string comparison and state machine validation. A test becomes as simple as: "If I press 'A', does the resulting string contain the 'USER MANAGEMENT' header?"

## **Future Outlook: The Autonomous Software Ecosystem**

The ultimate vision of ASCII-First Architecture is an autonomous software ecosystem where agents can build, deploy, and monitor complex systems with minimal human intervention. This relies on the "A2A Data Model," which standardizes objects like Task, Message, and Artifact.4

In this future, a human might give a high-level goal: "Monitor our server fleet and alert me if latency exceeds 200ms." An AI agent would:

1. **Design** a monitoring dashboard in ASCII.  
2. **Bind** the dashboard to the server logs.  
3. **Deploy** the dashboard as an ASCII-native app.  
4. **Invite** other specialized agents (e.g., an Alert Agent and a Resolution Agent) to interact with the dashboard using its Agent Card.4

This collaborative, text-native approach reduces the friction of software development to the speed of thought (and token generation). The "latent canvas" of LLMs, unlocked through SVE, becomes the primary workbench for the next generation of engineers.1

## **Conclusion**

The ASCII-First Architecture represents a fundamental shift in how we conceptualize the relationship between design and code. By acknowledging the strengths and limitations of current AI models, it proposes a medium that is both high-fidelity for reasoning and low-overhead for execution. The transition from pixel-perfect mockups to logic-perfect ASCII templates addresses the core challenges of modern software development: technical debt, AI hallucination, and the complexity of multi-agent coordination.

As we move toward a world of "what-you-type-is-what-you-see" software synthesis, the humble ASCII character—the pioneer of digital communication—finds its place as the most advanced architectural tool in our arsenal. It is the isomorphic middle ground where human intent and machine execution finally meet in a unified, stable, and deeply interactive medium.1 For the professional peer seeking to optimize AI-driven development, the recommendation is clear: simplify the medium to amplify the intelligence. Start with ASCII, and the functionality will follow.

## **Final Summary of Technical Standards and Implementation**

The implementation of ASCII-First Architecture is supported by a robust stack of modern technologies, despite its reliance on legacy text formats.

## **Serialization and Formatting**

The system relies on high-speed serialization frameworks in Rust to handle the state-to-view pipeline.10

* **Serde**: For mapping bindings.json to internal state objects.  
* **Toml/Ron**: Used as alternative configuration formats when human-readability is paramount.10  
* **Calamine**: For importing legacy data (like Excel spreadsheets) into the ASCII table views.10

## **Rendering and Interop**

The "renderer" layer uses WebAssembly to ensure that text-to-GUI conversion can happen anywhere.12

* **Wasmtime**: The runtime used by the ascii-server to execute binding logic securely.  
* **Wit-bindgen**: Generates the necessary glue code between the ASCII state and modern web APIs.12  
* **Trunk**: For bundling Rust-based ASCII renderers for web deployment.12

## **Interaction and Protocol**

The communication between agents and humans is governed by the A2A specification.4

* **JSON-RPC 2.0**: The default protocol for triggering actions from the ASCII interface.  
* **Server-Sent Events (SSE)**: For pushing real-time updates (like the moving progress bars) to the client without a full page refresh.4  
* **FIDO/UAF**: For securing high-stakes actions within the ASCII interface.5

This convergence of old and new—the 1960s ASCII standard meeting the 2020s AI agent—creates a development paradigm that is more resilient, more transparent, and more powerful than the disparate toolchains of the past. The ASCII view is no longer just a fallback; it is the definitive interface of the autonomous future.

#### **Works cited**

1. Unlocking the Latent Canvas: Eliciting and Benchmarking Symbolic Visual Expression in LLMs \- arXiv.org, accessed March 18, 2026, [https://arxiv.org/html/2603.14505v1](https://arxiv.org/html/2603.14505v1)  
2. Computer Vision and Pattern Recognition \- arXiv.org, accessed March 18, 2026, [https://www.arxiv.org/list/cs.CV/pastweek?skip=7\&show=1000](https://www.arxiv.org/list/cs.CV/pastweek?skip=7&show=1000)  
3. Preserving Command Line Workflow for a Package Management System Using ASCII DAG Visualization \- IEEE Computer Society, accessed March 18, 2026, [https://www.computer.org/csdl/journal/tg/2019/09/08419271/13rRUIM2VH7](https://www.computer.org/csdl/journal/tg/2019/09/08419271/13rRUIM2VH7)  
4. A2A/docs/specification.md at main · a2aproject/A2A \- GitHub, accessed March 18, 2026, [https://github.com/a2aproject/A2A/blob/main/docs/specification.md](https://github.com/a2aproject/A2A/blob/main/docs/specification.md)  
5. FIDO UAF Architectural Overview, accessed March 18, 2026, [https://fidoalliance.org/specs/fido-uaf-v1.1-id-20170202/FIDO-UAF-COMPLETE-v1.1-id-20170202.pdf](https://fidoalliance.org/specs/fido-uaf-v1.1-id-20170202/FIDO-UAF-COMPLETE-v1.1-id-20170202.pdf)  
6. UAF Architectural Overview \- FIDO Alliance, accessed March 18, 2026, [https://fidoalliance.org/specs/uaf-v1.0-id-20141122/FIDO-UAF-COMPLETE-v1.0-id-20141122.pdf](https://fidoalliance.org/specs/uaf-v1.0-id-20141122/FIDO-UAF-COMPLETE-v1.0-id-20141122.pdf)  
7. Understanding Character Encoding Schemes | PDF \- Scribd, accessed March 18, 2026, [https://www.scribd.com/document/926997654/1-6-Encoding-Schemes](https://www.scribd.com/document/926997654/1-6-Encoding-Schemes)  
8. How Modality Shapes Perception and Reasoning: A Study of Error Propagation in ARC-AGI \- arXiv.org, accessed March 18, 2026, [https://arxiv.org/pdf/2511.15717](https://arxiv.org/pdf/2511.15717)  
9. GitHub \- Dicklesworthstone/ntm: Named Tmux Manager: spawn, tile, and coordinate multiple AI coding agents (Claude, Codex, Gemini) across tmux panes with a TUI command palette, accessed March 18, 2026, [https://github.com/Dicklesworthstone/ntm](https://github.com/Dicklesworthstone/ntm)  
10. Encoding data — list of Rust libraries/crates // Lib.rs, accessed March 18, 2026, [https://lib.rs/encoding](https://lib.rs/encoding)  
11. Encoding data — list of Rust libraries/crates // Lib.rs, accessed March 18, 2026, [https://lib.rs/encoding?SO82zq4LYv65Sc=iJlUh](https://lib.rs/encoding?SO82zq4LYv65Sc=iJlUh)  
12. WebAssembly — list of Rust libraries/crates // Lib.rs, accessed March 18, 2026, [https://lib.rs/wasm](https://lib.rs/wasm)  
13. Modern Architecture Overview 1900-1987 | PDF \- Scribd, accessed March 18, 2026, [https://www.scribd.com/document/953961748/Modern-Architecture-Since-1900-William-J-R-Curtis](https://www.scribd.com/document/953961748/Modern-Architecture-Since-1900-William-J-R-Curtis)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAZCAYAAAAFbs/PAAAAtElEQVR4XmNgGAV0ANxALI0uiAswAvElKEYGXkD8BE0MDEqB+D8QFyKJMQHxGyB+jyQGB1sYIBr0kcRAbJDYRiQxOPgIxM/RxLIZIBqK0cTBACSxAk1sDVTcHE0cDEASSUj8CKjYZigfxRY+BojkTCSxZ1CxGUDMDMTySHIMPkD8Aoj/AvEqIF4NxApAXAXEd4F4KVwlFJwEYg10QVyAB4h/owviA6CYBLmVaODLQKINIw4AAIanJAmzGtPSAAAAAElFTkSuQmCC>