const passport = require("passport");
const { ExtractJwt, Strategy } = require("passport-jwt");
const config = require("../config");
const Users = require("../db/models/Users");
const UserRoles = require("../db/models/UserRoles");
const RolePrivileges = require("../db/models/RolePrivileges");
const allPrivileges = require("../config/role_privileges");
const Response = require("./Response");
const CustomError = require("./Error");
const {HTTP_CODES} = require("../config/Enum");


module.exports = function() {
    let strategy = new Strategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.JWT.SECRET,
        },
        async (payload, done) => {
            
            try {
                
                let user = await Users.findOne({ _id: payload.id });

                if (user) {
                    
                    let userRoles = await UserRoles.find({ user_id: payload.id});
    
                    let rolePrivileges = await RolePrivileges.find({ role_id: {$in: userRoles.map(ur => ur.role_id)}});

                    // Maps DB role privileges to config privileges based on matching 'permission' and 'key'
                    let privileges = rolePrivileges.map(rp => allPrivileges.privileges.find(p => p.key == rp.permission));
                    
                    // done(errorParam, dataParam)
                    // The user object passed as dataParam will be available under req.user
                    done(null, {
                        id: user._id,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        language: user.language,
                        roles: privileges,
                        exp: parseInt(Date.now() / 1000) + config.JWT.EXPIRE_TIME 
                    });
    
                } else {
                    done(new Error("User not found!", null));
                }

            } catch (err) {
                done(err, null);
            }

        }
    );

    passport.use(strategy);

    return {
        initialize: function() {
            return passport.initialize();
        },

        authenticate: function() {
            return passport.authenticate("jwt", { session: false });
        },

        checkRoles: (...expectedRoles) => {
            return (req, res, next) => {

                let i = 0;
                let privileges = req.user.roles.filter(r => r).map(ur => ur.key);

                // Iterate through expected roles; if none match user's privileges, access is denied
                while(i <= expectedRoles.length && !privileges.includes(expectedRoles[i])) i++;

                if (i >= expectedRoles.length) {
                    let response = Response.errorResponse(new CustomError(HTTP_CODES.UNAUTHORIZED, "Unauthorized", "Insufficient privileges to access this resource"));
                    return res.status(response.code).json(response);
                } 

                next(); // authorized
            };
        }
    };
};