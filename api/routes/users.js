const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const is = require("is_js");
const jwt = require("jsonwebtoken");

const Response = require('../lib/Response');
const CustomError = require('../lib/Error');
const Enum = require('../config/Enum');
const Users = require("../db/models/Users");
const UserRoles = require('../db/models/UserRoles');
const Roles = require('../db/models/Roles');
const config = require("../config");
const auth = require("../lib/auth")();

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
    
    if (is.not.email(body.email)) {
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


router.post("/auth", async (req, res) => {
  try {
    
    let {email, password} = req.body;

    if( !email || !password ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Email and password are required");

    Users.validateFieldsBeforeAuth(email, password);

    let user = await Users.findOne({ email });

    if (!user) throw new CustomError(Enum.HTTP_CODES.UNAUTHORIZED, "Validation Error!", "Email or password is wrong");
    if (!user.validPassword(password)) throw new CustomError(Enum.HTTP_CODES.UNAUTHORIZED, "Validation Error!", "Email or password is wrong");

    
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
    let users = await Users.find({});

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
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Email is required");
    }
    
    if (is.not.email(body.email)) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Email must be in a valid format");
    }
    
    if (!body.password) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Password field is required");
    }
    
    if (body.password.length < Enum.PASSWORD_LENGTH) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", `Password must be at least ${Enum.PASSWORD_LENGTH} characters`);
    }

    if (!body.roles || !Array.isArray(body.roles) || body.roles.length == 0) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "Role field is required and must be an array");
    }

    let roles = await Roles.find({ _id: {$in: body.roles}});

    if (roles.length !== body.roles.length) {
      let foundRoles = roles.map(role => role._id.toString());
      let missingRoles = body.roles.filter(roleId => !foundRoles.includes(roleId));

      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", `Not found Roles: ${missingRoles.join(", ")}`);
    }

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
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});


router.put("/update", auth.checkRoles("user_update"), async (req, res) => {
  let body = req.body;

  try {
    let updates = {};
    if ( !body._id ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "_id field is required");
    if ( body.password && body.password.length < Enum.PASSWORD_LENGTH ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", `Password must be at least ${Enum.PASSWORD_LENGTH} characters`);

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
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});


router.delete("/delete", auth.checkRoles("user_delete"), async (req, res) => {
  let body = req.body;

  try {
    if ( !body._id ) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "_id field is required");

    await Users.deleteOne({_id: body._id});
    await UserRoles.deleteMany({ user_id: body._id });

    res.json(Response.successResponse({ success: true }));

  } catch (err) {
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});



module.exports = router;
