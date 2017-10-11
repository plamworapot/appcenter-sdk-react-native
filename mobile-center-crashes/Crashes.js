const ReactNative = require('react-native');

const { RNCrashes } = ReactNative.NativeModules;

const willSendEvent = 'MobileCenterErrorReportOnBeforeSending';
const sendDidSucceed = 'MobileCenterErrorReportOnSendingSucceeded';
const sendDidFail = 'MobileCenterErrorReportOnSendingFailed';

// This is set later if and when the user provides a value for the getErrorAttachments callback
let getErrorAttachmentsMethod = () => {};
const filteredReports = [];

const UserConfirmation = {
    Send: 1,
    DontSend: 2,
    AlwaySend: 3
};

const ErrorAttachmentLog = {

    // Create text attachment for an error report
    attachmentWithText(text, fileName) {
        return { text, fileName };
    },

    // Create binary attachment for an error report, binary must be passed as a base64 string
    attachmentWithBinary(data, fileName, contentType) {
        return { data, fileName, contentType };
    }
};

let Crashes = {
    // async - returns a Promise
    generateTestCrash() {
        return RNCrashes.generateTestCrash();
    },

    // async - returns a Promise
    hasCrashedInLastSession() {
        return RNCrashes.hasCrashedInLastSession();
    },

    // async - returns a Promise
    lastSessionCrashReport() {
        return RNCrashes.lastSessionCrashReport();
    },

    // async - returns a Promise
    isEnabled() {
        return RNCrashes.isEnabled();
    },

    // async - returns a Promise
    setEnabled(shouldEnable) {
        return RNCrashes.setEnabled(shouldEnable);
    },

    notifyWithUserConfirmation(userConfirmation) {
        RNCrashes.notifyWithUserConfirmation(userConfirmation);
        Helper.sendErrorAttachments(filteredReports);
    },

    setEventListener(listenerMap) {
        ReactNative.DeviceEventEmitter.removeAllListeners(willSendEvent);
        ReactNative.DeviceEventEmitter.removeAllListeners(sendDidSucceed);
        ReactNative.DeviceEventEmitter.removeAllListeners(sendDidFail);
        if (!listenerMap) {
            return;
        }
        if (listenerMap.willSendCrash) {
            ReactNative.DeviceEventEmitter.addListener(willSendEvent, listenerMap.willSendCrash);
        }
        if (listenerMap.didSendCrash) {
            ReactNative.DeviceEventEmitter.addListener(sendDidSucceed, listenerMap.didSendCrash);
        }
        if (listenerMap.failedSendingCrash) {
            ReactNative.DeviceEventEmitter.addListener(sendDidFail, listenerMap.failedSendingCrash);
        }
        getErrorAttachmentsMethod = listenerMap.getErrorAttachments;
        RNCrashes.getUnprocessedCrashReports()
            .then((reports) => {
                const filteredReportIds = [];
                reports.forEach((report) => {
                    if (!listenerMap.shouldProcess ||
                        listenerMap.shouldProcess(report)) {
                        filteredReports.push(report);
                        filteredReportIds.push(report.id);
                    }
                });
                RNCrashes.sendCrashReportsOrAwaitUserConfirmationForFilteredIds(filteredReportIds).then((alwaysSend) => {
                    if (alwaysSend) {
                        Helper.sendErrorAttachments(filteredReports);
                    } else if (!listenerMap.shouldAwaitUserConfirmation || !listenerMap.shouldAwaitUserConfirmation()) {
                        Crashes.notifyWithUserConfirmation(UserConfirmation.Send);
                    }
                });
            });
    }
};

let Helper = {
    sendErrorAttachments(errorReports) {
        if (!getErrorAttachmentsMethod || !errorReports) {
            return;
        }
        errorReports.forEach((report) => {
            const attachments = getErrorAttachmentsMethod(report);
            RNCrashes.sendErrorAttachments(attachments, report.id);
        });
    }
};

// Android does not have "isDebuggerAttached" method
if (Crashes && RNCrashes && RNCrashes.isDebuggerAttached) {
    Crashes = Object.assign({
        // async - returns a Promise
        isDebuggerAttached() {
            return RNCrashes.isDebuggerAttached();
        },
    }, Crashes);
}

module.exports = { Crashes, ErrorAttachmentLog, UserConfirmation };
