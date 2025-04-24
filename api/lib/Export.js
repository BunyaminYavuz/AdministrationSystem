const xlsx = require("node-xlsx");

class Export {

    constructor() {
        // Initializes the Export class.
    }

    /**
     * Exports data to an Excel sheet.
     *
     * @param {Array} titles Excel header row titles.             E.g., ["ID", "CATEGORY NAME", "IS ACTIVE"]
     * @param {Array} columns Data object keys for Excel columns. E.g., [_id,       name,        is_active]
     * @param {Array} data Array of row data objects. Defaults to [].
     */
    toExcel(titles, columns, data = []) {
        let rows = [];
        rows.push(titles);
    
        for (let i = 0; i < data.length; i++) {
            
            let item = data[i];
            /*
            [
                [ "ID",       "CATEGORY NAME",  "IS ACTIVE"]
                [ "1234...",  "Category-1",     true],
                [ "1234...",  "Category-2",     false],
                ...
            ] 
            */

            let cols = [];
    
            for (let j = 0; j < columns.length; j++) {
                let value = item[columns[j]];
    
                // Boolean format
                if (typeof value === "boolean") {
                    value = value ? "TRUE" : "FALSE";
                }
    
                // ObjectId to string
                if (value && value._bsontype === "ObjectID") {
                    value = value.toString();
                }
    
                // Date format (dd.MM.yyyy)
                if (value instanceof Date) {
                    const day = String(value.getDate()).padStart(2, '0');
                    const month = String(value.getMonth() + 1).padStart(2, '0');
                    const year = value.getFullYear();
                    value = `${day}.${month}.${year}`;
                }
    
                cols.push(value ?? "");
            }
    
            rows.push(cols);
        }
    
        return xlsx.build([{ name: "Sheet", data: rows }]);
    }
    
}

module.exports = Export;