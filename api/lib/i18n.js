const i18n = require("../i18n");

class I18n {

    constructor(lang) {
        this.lang = lang;
    }

    translate(text, lang = this.lang, params = []) {

        let arr = text.split(".");  // COMMON.VALIDATION_ERROR_TITLE -> arr["COMMON", "VALIDATION", "ERROR", "TITLE"]

        let val = i18n[lang][arr[0]]; // Gets the {"VALIDATION_ERROR_TITLE": "Validation Error"} object from i18n["EN"]["COMMON"] and assigns it to val

        for (let i = 1; i < arr.length; i++) {
            val = val[arr[i]]; // for i = 1 val["VALIDATION_ERROR_TITLE"] is "Validation Error"
        }


        val = val + ""; // Call by value; otherwise, the reference value will be changed

        for (let i = 0; i < params.length; i++) {
            val = val.replace("{}", params[i]);
        }

        return val || "Error!";
    }
}

module.exports = I18n;