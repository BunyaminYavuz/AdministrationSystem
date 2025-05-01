const mongoose = require("mongoose");
const Roles = require("./Roles");
const Users = require("./Users");

const schema = mongoose.Schema({
    role_id: {
        ref: Roles,
        type: mongoose.SchemaTypes.ObjectId,
        required : true
        }, 
    user_id: {
        ref: Users,
        type: mongoose.SchemaTypes.ObjectId,
        required : true
        },
},
    {
    versionKey: false,
    timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at"
    }
});

class UserRoles extends mongoose.Model {

}
schema.loadClass(UserRoles);
module.exports = mongoose.model("user_roles", schema);