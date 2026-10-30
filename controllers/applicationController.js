const Application = require("../models/Application");
const Job = require("../models/Job");

exports.createApplication = async (req, res, next) => {
    try {
        const {
            jobId,
            company,
            jobTitle,
            location,
            salary,
            jobUrl,
            recruiterName,
            recruiterEmail,
            interviewDate,
            status = "Applied",
            notes = ""
        } = req.body;

        let applicationData = {
            user: req.user._id,
            status,
            notes,
            appliedAt: new Date()
        };

        if (jobId) {
            const job = await Job.findById(jobId);
            if (!job) {
                return res.status(404).json({ success: false, error: "Referenced job not found" });
            }
            applicationData.job = job._id;
            applicationData.company = job.company;
            applicationData.jobTitle = job.title;
            applicationData.location = job.location;
            applicationData.jobUrl = job.sourceUrl || "";
            applicationData.salary = job.minSalary && job.maxSalary
                ? `${job.currency} ${job.minSalary} - ${job.maxSalary}`
                : "";
        } else {
            if (!company || !jobTitle) {
                return res.status(400).json({
                    success: false,
                    error: "Company and Job Title are required for custom applications."
                });
            }
            applicationData.company = company.trim();
            applicationData.jobTitle = jobTitle.trim();
            applicationData.location = location ? location.trim() : "Remote";
            applicationData.salary = salary ? salary.trim() : "";
            applicationData.jobUrl = jobUrl ? jobUrl.trim() : "";
            applicationData.recruiterName = recruiterName ? recruiterName.trim() : "";
            applicationData.recruiterEmail = recruiterEmail ? recruiterEmail.trim() : "";
            if (interviewDate) {
                applicationData.interviewDate = new Date(interviewDate);
            }
        }

        const application = await Application.create(applicationData);
        const populated = await application.populate("job");

        res.status(201).json({
            success: true,
            message: "Application added to pipeline",
            data: populated,
            ...populated.toObject()
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: "An application already exists for this job in your tracker."
            });
        }
        next(error);
    }
};

exports.listApplications = async (req, res, next) => {
    try {
        const { status, q, sort = "recent" } = req.query;
        const filter = { user: req.user._id };

        if (status && status !== "All") {
            filter.status = status;
        }

        let sortBy = { updatedAt: -1 };
        if (sort === "oldest") {
            sortBy = { appliedAt: 1 };
        } else if (sort === "company") {
            sortBy = { company: 1 };
        } else if (sort === "interview") {
            sortBy = { interviewDate: 1 };
        }

        let items = await Application.find(filter)
            .populate("job")
            .sort(sortBy);

        if (q) {
            const queryLower = String(q).toLowerCase();
            items = items.filter(item => {
                const title = (item.jobTitle || item.job?.title || "").toLowerCase();
                const comp = (item.company || item.job?.company || "").toLowerCase();
                const note = (item.notes || "").toLowerCase();
                return title.includes(queryLower) || comp.includes(queryLower) || note.includes(queryLower);
            });
        }

        res.json(items);
    } catch (error) {
        next(error);
    }
};

exports.updateApplication = async (req, res, next) => {
    try {
        const {
            status,
            notes,
            company,
            jobTitle,
            location,
            salary,
            jobUrl,
            recruiterName,
            recruiterEmail,
            interviewDate
        } = req.body;

        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (company !== undefined) updateData.company = company;
        if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
        if (location !== undefined) updateData.location = location;
        if (salary !== undefined) updateData.salary = salary;
        if (jobUrl !== undefined) updateData.jobUrl = jobUrl;
        if (recruiterName !== undefined) updateData.recruiterName = recruiterName;
        if (recruiterEmail !== undefined) updateData.recruiterEmail = recruiterEmail;
        if (interviewDate !== undefined) {
            updateData.interviewDate = interviewDate ? new Date(interviewDate) : null;
        }

        const item = await Application.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            updateData,
            { new: true, runValidators: true }
        ).populate("job");

        if (!item) {
            return res.status(404).json({ success: false, error: "Application not found" });
        }

        res.json({
            success: true,
            message: "Application updated successfully",
            data: item,
            ...item.toObject()
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteApplication = async (req, res, next) => {
    try {
        const item = await Application.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        if (!item) {
            return res.status(404).json({ success: false, error: "Application not found" });
        }

        res.json({
            success: true,
            message: "Application removed from tracker"
        });
    } catch (error) {
        next(error);
    }
};
