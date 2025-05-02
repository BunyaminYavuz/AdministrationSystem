const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const validator = require('validator');
const jwt = require("jsonwebtoken");

const Response = require('../lib/Response');
const CustomError = require('../lib/Error');
const Enum = require('../config/Enum');
const Users = require("../db/models/Users");
const UserRoles = require('../db/models/UserRoles');
const Roles = require('../db/models/Roles');
const config = require("../config");
const RolePrivileges = require('../db/models/RolePrivileges');
const auth = require("../lib/auth")();
const i18n = new (require("../lib/i18n"))(config.DEFAULT_LANG);
const { rateLimit } = require("express-rate-limit");
const MongoStore = require('rate-limit-mongo');

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	store: new MongoStore({
    uri: config.CONNECTION_STRING,
    collectionName: "rateLimits",
    // should match windowMs
    expireTimeMs: 15 * 60 * 1000,
  }),
});

router.post("/register", async (req, res) => {
  let body = req.body;

  try {

    let user = await Users.findOne({});

    if (user) {
      return res.sendStatus(Enum.HTTP_CODES.NOT_FOUND);
    }

    if (!body.email) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Email is required");
    }
    
    if (!validator.isEmail(body.email)) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Email must be in a valid format");
    }
    
    if (!body.password) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Password field is required");
    }
    
    if (body.password.length < Enum.PASSWORD_LENGTH) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", `Password must be at least ${Enum.PASSWORD_LENGTH} characters`);
    }
    
    let password = await bcrypt.hash(body.password, 10);
  
    
    let createdUser = await Users.create({
      email: body.email,
      password,
      first_name: body.first_name,
      last_name: body.last_name,
      phone_number: body.phone_number
    });

    let role = await Roles.create({
      role_name: Enum.SUPER_ADMIN,
      created_by: createdUser._id
    });

    await UserRoles.create({
      role_id: role._id,
      user_id: createdUser._id
    });
    
    

    if ( Array.isArray(body.role_id) && body.role_id > 0 ) {
      for ( let i = 0; i < body.role_id.length; i++ ) {
        await UserRoles.create({
          role_id: body.role_id[i],
          user_id: createdUser._id
        });
      }
    }

    res.status(Enum.HTTP_CODES.CREATED).json(Response.successResponse( { success: true }, Enum.HTTP_CODES.CREATED));

  } catch (err) {
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});


router.post("/auth", limiter, async (req, res) => {
  try {
    
    let {email, password} = req.body;

    if( !email || !password ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", config.DEFAULT_LANG), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", config.DEFAULT_LANG, ["Email and password"]));

    Users.validateFieldsBeforeAuth(email, password);

    let user = await Users.findOne({ email });

    if (!user) throw new CustomError(Enum.HTTP_CODES.UNAUTHORIZED, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", config.DEFAULT_LANG), i18n.translate("USERS.AUTH_ERROR", config.DEFAULT_LANG));
    
    if (!user.validPassword(password)) throw new CustomError(Enum.HTTP_CODES.UNAUTHORIZED, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", config.DEFAULT_LANG), i18n.translate("USERS.AUTH_ERROR", config.DEFAULT_LANG));

    
      let payload = {
        id: user.id,
        exp: parseInt(Date.now() / 1000) * config.JWT.EXPIRE_TIME
      };

      let token = jwt.sign(payload, config.JWT.SECRET);

      let userData = {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
      };

      res.json(Response.successResponse({token, user: userData}));

  } catch (err) {
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});


router.all("*", auth.authenticate(), (req, res, next) => {
    next();
});


/* GET users listing. */
router.get("/", auth.checkRoles("user_view"), async (req, res) => {
  try {
    let users = await Users.find({}, {password: 0}).lean();

    for (let i = 0; i < users.length; i++) {
      let roles = await UserRoles.find({ user_id: users[i]._id }).populate("role_id");
      users[i].roles = roles;
    }

    res.json(Response.successResponse( users ));
  } catch (err) {
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});


router.post("/add", auth.checkRoles("user_add"), async (req, res) => {
  let body = req.body;

  try {
    if (!body.email) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["email"]));
    }
    
    if (!validator.isEmail(body.email)) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("USERS.FIELD_VALID_FORMAT", req.user.language, ["email", "email"]));
    }
    
    if (!body.password) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["password"]));
    }
    
    if (body.password.length < Enum.PASSWORD_LENGTH) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("USERS.PASSWORD_LENGTH_ERROR", req.user.language, [Enum.PASSWORD_LENGTH]));
    }

    if (!body.roles || !Array.isArray(body.roles) || body.roles.length == 0) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_TYPE", req.user.language, ["roles", "Array"]));
    }

    let roles = await Roles.find({ _id: {$in: body.roles}});

    if (roles.length == 0) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language),i18n.translate("COMMON.FIELD_MUST_BE_TYPE", req.user.language, ["roles", "Array"]));
    }

    /*    To inform missing roles

    if (roles.length !== body.roles.length) {
      let foundRoles = roles.map(role => role._id.toString());
      let missingRoles = body.roles.filter(roleId => !foundRoles.includes(roleId));

      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST,i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), `Not found Roles: ${missingRoles.join(", ")}`);
    }

    */

    let password = await bcrypt.hash(body.password, 10);
  

    let user = await Users.create({
      email: body.email,
      password,
      first_name: body.first_name,
      last_name: body.last_name,
      phone_number: body.phone_number
    });

    for ( let i = 0; i < roles.length; i++ ) {
      await UserRoles.create({
        role_id: roles[i]._id,
        user_id: user._id
      });
    }

    res.status(Enum.HTTP_CODES.CREATED).json(Response.successResponse( { success: true }, Enum.HTTP_CODES.CREATED));

  } catch (err) {
    let errorResponse = Response.errorResponse(err, req.user.language);
    res.status(errorResponse.code).json(errorResponse);
  }
});


router.put("/update", auth.checkRoles("user_update"), async (req, res) => {
  let body = req.body;

  try {
    let updates = {};
    if ( !body._id ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["_id"]));
    if ( body.password && body.password.length < Enum.PASSWORD_LENGTH ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("USERS.PASSWORD_LENGTH_ERROR", req.user.language, [Enum.PASSWORD_LENGTH]));

    if ( body.password && body.password >= Enum.PASSWORD_LENGTH ) {
      updates.password = await bcrypt.hash(body.password, 10);
    }


    if ( body.first_name ) updates.first_name = body.first_name;
    if ( body.last_name ) updates.last_name = body.last_name;
    if ( body.phone_number ) updates.phone_number = body.phone_number;
    if ( typeof body.is_active === "boolean" ) updates.is_active = body.is_active;

    if ( Array.isArray(body.roles) && body.roles.length > 0) {
      // userRoles => {role_id: "RoleId", user_id: "UserId"}
      // body.roles => ["RoleId", "RoleId", ...]
      let userRoles = await UserRoles.find({ user_id: body._id });

      let deletedUserRoles = userRoles.filter(userRole => !body.roles.includes(userRole.role_id));
      let newUserRoles = body.roles.filter(role => !userRoles.map( userRole => userRole.role_id).includes(role));
      
      if (deletedUserRoles.length > 0 ) {
        await UserRoles.deleteMany({ role_id: { $in: deletedUserRoles.map( role => role.role_id.toString() ) }});
      }

      if (newUserRoles.length > 0) {
        for (let i = 0; i < newUserRoles.length; i++) {
          let userRole = new UserRoles({
            role_id: newUserRoles[i],
            user_id: body._id,
          });
          
          await userRole.save();
        }
      }
    }

    await Users.updateOne({_id: body._id}, updates);

    res.json(Response.successResponse({ success: true }));

  } catch (err) {
    let errorResponse = Response.errorResponse(err, req.user.language);
    res.status(errorResponse.code).json(errorResponse);
  }
});


router.delete("/delete", auth.checkRoles("user_delete"), async (req, res) => {
  let body = req.body;

  try {
    if ( !body._id ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language),i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["_id"]));

    await Users.deleteOne({_id: body._id});
    await UserRoles.deleteMany({ user_id: body._id });

    res.json(Response.successResponse({ success: true }));

  } catch (err) {
    let errorResponse = Response.errorResponse(err, req.user.language);
    res.status(errorResponse.code).json(errorResponse);
  }
});



module.exports = router;
