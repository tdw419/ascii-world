import { z } from 'zod';
export declare const DeltaOperationType: any;
export declare const DeltaSchema: any;
export declare const ChangeSchema: any;
export type DeltaOperation = z.infer<typeof DeltaOperationType>;
export type Delta = z.infer<typeof DeltaSchema>;
export type Change = z.infer<typeof ChangeSchema>;
//# sourceMappingURL=change.schema.d.ts.map