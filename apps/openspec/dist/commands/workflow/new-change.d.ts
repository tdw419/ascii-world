/**
 * New Change Command
 *
 * Creates a new change directory with optional description and schema.
 */
export interface NewChangeOptions {
    description?: string;
    schema?: string;
}
export declare function newChangeCommand(name: string | undefined, options: NewChangeOptions): Promise<void>;
//# sourceMappingURL=new-change.d.ts.map