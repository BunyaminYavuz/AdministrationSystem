const express = require("express");
const router = express.Router();

const Roles = require("../db/models/Roles");
const RolePrivileges = require("../db/models/RolePrivileges");
const role_privileges = require("../config/role_privileges");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const config = require("../config");
const auth = require("../lib/auth")();
const i18n = new (require("../lib/i18n"))(config.DEFAULT_LANG);

router.all("*", auth.authenticate(), (req, res, next) => {
    next();
});


router.get("/", auth.checkRoles("role_view"), async (req, res) => {
    try {
        
        let roles = await Roles.find({});

        res.json(Response.successResponse( roles ));

    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});


router.post("/add", auth.checkRoles("role_add"), async (req, res) => {
    let body = req.body;
    try {
        if (!body.role_name) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["role_name"]));
        if (!body.permissions || !Array.isArray(body.permissions) || body.permissions.length == 0) {
            throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST,  i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_ARRAY", req.user.language, ["permissions", "Array"]));
        } 
            

        let role = new Roles({
            role_name: body.role_name,
            is_active: true,
            created_by: req.user?._id
        });

        await role.save();


    for (let i = 0; i < body.permissions.length; i++ ) {
        let priv  = new RolePrivileges({
            role_id: role._id,
            permission: body.permissions[i],
            created_by: req.user?._id
        });
        await priv.save();
    }
        

        res.status(Enum.HTTP_CODES.CREATED).json(Response.successResponse({ success: true }));
        
    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});


router.put("/update", auth.checkRoles("role_update"), async (req, res) => {
    let body = req.body;
    try {
        if (!body._id) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST,  i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["_id"]));
        
        let updates = {};
        
        if(body.role_name) updates.role_name = body.role_name;
        if(typeof body.is_active === "boolean") updates.is_active = body.is_active;

        await Roles.updateOne({ _id: body._id }, updates);

        if (body.permissions && Array.isArray(body.permissions) && body.permissions.length > 0 ) {

            let permissons = await RolePrivileges.find({ role_id: body._id });

            // body.permissions => ["user_view", "category_view"]
            // permissons => [{"role_id": "123", "permission": "user_add", _id: "234"}]

            let deletedPermissions = permissons.filter(p => !body.permissions.includes(p.permission)); 
            let newPermissions = body.permissions.filter(p => !permissons.map(p => p.permission).includes(p));

            if ( deletedPermissions.length > 0 ) {
                await RolePrivileges.deleteMany({ _id: {$in: deletedPermissions.map(p => p._id)}});
            }

            if ( newPermissions.length > 0 ) {
                for (let i = 0; i < newPermissions.length; i++) {
                    let priv = new RolePrivileges({
                        role_id: body._id,
                        permission: newPermissions[i],
                        created_by: req.user?._id
                    });

                    await priv.save();
                }
            }

        }
            
        res.json(Response.successResponse({ success: true }));
        
    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});


router.delete("/delete", auth.checkRoles("role_delete"), async (req, res) => {
    let body = req.body;
    try{

        if (!body._id) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST,  i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["_id"]));
        
        await Roles.deleteOne({_id: body._id});

        res.json(Response.successResponse({ success: true }));

    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});


router.get("/role_privileges", auth.checkRoles("role_view"), async (req, res) => {
    try {

        res.json(Response.successResponse({ role_privileges }));

    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});

module.exports = router;