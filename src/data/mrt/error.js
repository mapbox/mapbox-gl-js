// @noflow
class MRTError extends Error {
    /**
     * @param {string} message - error message
     */
    constructor(message) {
        super(message);
        this.name = 'MRTError';
    }
}

export default MRTError;

export {MRTError};
