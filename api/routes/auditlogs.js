const express = require("express");
const router = express.Router();
const moment = require("moment");
const AuditLogs = require("../db/models/AudiLogs");
const Response = require("../lib/Response");
const auth = require("../lib/auth")();

router.all("*", auth.authenticate(), (req, res, next) => {
    next();
});


router.post ("/", auth.checkRoles("auditlogs_view"),  async (req, res) => {
    
    try {

        let body = req.body;
        let query = {};

        let limit = body.limit;
        let skip = body.skip;

        if (typeof skip !== "number") {
            skip = 0;
        }

        if (typeof limit !== "number" || limit > 500) {
            limit = 500;
        }

        if (body.begin_date && body.end_date) {
            query.created_at = {
                $gte: moment(body.begin_date),
                $lte: moment(body.end_date)
            };
        } else {
            query.created_at = {
                $gte: moment().subtract(1, "day").startOf("day"),
                $lte: moment()
            };
        }


        let auditLogs = await AuditLogs.find( query ).sort({ created_by: -1 }).limit( limit ).skip( skip );

        res.json(Response.successResponse(auditLogs));

    } catch (err) {
        let errorResponse = Response.errorResponse(err);
        res.status(errorResponse.code).json(errorResponse);
    }
});

module.exports = router;