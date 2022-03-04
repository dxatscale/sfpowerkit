// TODO: DiffGenerator is a base class
export default interface DiffGenerator {
    revFrom: string;
    revTo: string;
    compareRevisions(): Promise<any>;
}
