import { z } from 'zod';
export declare const ArtifactSchema: any;
export declare const ApplyPhaseSchema: any;
export declare const SchemaYamlSchema: any;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type ApplyPhase = z.infer<typeof ApplyPhaseSchema>;
export type SchemaYaml = z.infer<typeof SchemaYamlSchema>;
export declare const ChangeMetadataSchema: any;
export type ChangeMetadata = z.infer<typeof ChangeMetadataSchema>;
export type CompletedSet = Set<string>;
export interface BlockedArtifacts {
    [artifactId: string]: string[];
}
//# sourceMappingURL=types.d.ts.map