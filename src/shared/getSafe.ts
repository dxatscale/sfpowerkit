export function  getSafe(fn, defaultVal) {
    try {
        return fn();
    } catch (e) {
        this.console.log("test"+e);
        return defaultVal;
    }
}