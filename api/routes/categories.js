var express = require("express");
var router = express.Router();
const Categories = require("../db/models/Categories");
const Response = require("../lib/Response");
const Enum = require("../config/Enum");
const CustomError = require("../lib/Error");
const AudiLogs = require("../lib/AuditLogs");
const logger = require("../lib/logger/LoggerClass");
const auth = require("../lib/auth")();

router.all("*", auth.authenticate(), (req, res, next) => {
    next();
});

router.get("/", auth.checkRoles("category_view"), async (req, res) => {
    try {
        let categories = await Categories.find({});

        res.json(Response.successResponse(categories));

    } catch (err) {
        let errorResponse = Response.errorResponse(err);
        res.status(errorResponse.code).json(errorResponse);
    }
});



router.post("/add", auth.checkRoles("category_add"), async (req, res) => {
    try{
        let body = req.body;

        if (!body.name) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "name field must be filled");
        

        let category = new Categories({
            name: body.name,
            is_active: true,
            created_by: req.user?._id
        });

        await category.save();

        AudiLogs.info(req.user?.email, "Categories", "Add", category );
        logger.info(req.user?.email, "Categories", "Add", category);

        res.status(Enum.HTTP_CODES.CREATED).json(Response.successResponse( category ));

    } catch (err) {
        logger.error(req.user?.email, "Categories", "Add", err);
        let errorResponse = Response.errorResponse(err);
        res.status(errorResponse.code).json(errorResponse);
    }
});


router.put("/update", auth.checkRoles("category_update"), async (req, res) => {
    try{
        let body = req.body;
        let updates = {};

        if (!body._id) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "_id field must be filled");
        
        if (body.name) updates.name = body.name;
        if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

        await Categories.updateOne({_id: body._id}, updates);

        AudiLogs.info(req.user?.email, "Category", "Update", { _id: body._id, ...updates });

        res.json(Response.successResponse({ success: true }));

    } catch (err) {
        let errorResponse = Response.errorResponse(err);
        res.status(errorResponse.code).json(errorResponse);
    }
});



router.delete("/delete", auth.checkRoles("category_delete"), async (req, res) => {
    try{
        let body = req.body;

        if (!body._id) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "_id field must be filled");
        
        await Categories.deleteOne({_id: body._id});

        AudiLogs.info(req.user?.email, "Category", "Delete", { _id: body._id });

        res.json(Response.successResponse({ success: true }));

    } catch (err) {
        let errorResponse = Response.errorResponse(err);
        res.status(errorResponse.code).json(errorResponse);
    }
});


module.exports = router;