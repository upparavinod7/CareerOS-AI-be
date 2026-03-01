const mockJobs = [
    {
        providerId: "mock-1001",
        title: "Backend Engineer",
        company: "NovaStack",
        location: "Remote",
        role: "Backend Developer",
        experienceLevel: "Mid",
        minSalary: 90000,
        maxSalary: 130000,
        currency: "USD",
        description: "Build Node.js microservices, optimize PostgreSQL, implement CI/CD and observability.",
        skills: ["node", "database", "docker", "system_design"],
        sourceUrl: "https://example.com/jobs/backend-engineer",
        demandScore: 84
    },
    {
        providerId: "mock-1002",
        title: "Machine Learning Engineer",
        company: "DeepCore AI",
        location: "Bangalore",
        role: "AI/ML Engineer",
        experienceLevel: "Senior",
        minSalary: 140000,
        maxSalary: 190000,
        currency: "USD",
        description: "Develop PyTorch models, deploy inference APIs, monitor data drift and retraining loops.",
        skills: ["python", "pytorch", "model_serving", "mlops"],
        sourceUrl: "https://example.com/jobs/ml-engineer",
        demandScore: 91
    },
    {
        providerId: "mock-1003",
        title: "Frontend Engineer",
        company: "PixelForge",
        location: "Hyderabad",
        role: "Frontend Developer",
        experienceLevel: "Junior",
        minSalary: 70000,
        maxSalary: 105000,
        currency: "USD",
        description: "Ship React + TypeScript features, improve web performance and accessibility.",
        skills: ["react", "typescript", "css", "performance"],
        sourceUrl: "https://example.com/jobs/frontend-engineer",
        demandScore: 78
    },
    {
        providerId: "mock-1004",
        title: "DevOps Engineer",
        company: "CloudRail",
        location: "Pune",
        role: "DevOps Engineer",
        experienceLevel: "Mid",
        minSalary: 100000,
        maxSalary: 145000,
        currency: "USD",
        description: "Manage Kubernetes clusters, Terraform IaC, and security hardening for CI/CD pipelines.",
        skills: ["kubernetes", "terraform", "ci_cd", "aws"],
        sourceUrl: "https://example.com/jobs/devops-engineer",
        demandScore: 88
    }
];

module.exports = { mockJobs };
