const User = require("../models/User");

exports.getMe = async (req, res, next) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        next(error);
    }
};

exports.updateMe = async (req, res, next) => {
    try {
        const allowedFields = ["name", "skills", "experienceYears", "targetRole", "resumeText"];
        const update = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                update[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(req.user._id, update, {
            new: true,
            runValidators: true,
            select: "-password"
        });

        res.json({ user });
    } catch (error) {
        next(error);
    }
};
