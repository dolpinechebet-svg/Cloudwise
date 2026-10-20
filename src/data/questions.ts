import type { Domain, Question } from "../types";

export const domains: Domain[] = [
  "Cloud concepts",
  "Azure architecture and services",
  "Azure management and governance"
];

export const sampleQuestions: Question[] = [
  {
    id: "cloud-001",
    domain: "Cloud concepts",
    topic: "Shared responsibility",
    difficulty: 1,
    question_text: "In the shared responsibility model, who is responsible for securing the physical datacenter?",
    options: ["The customer", "The cloud provider", "The internet service provider", "The software developer"],
    correct_index: 1,
    base_explanation: "The cloud provider is responsible for the physical datacenter and the underlying cloud infrastructure. The customer's responsibilities depend on the cloud service they use."
  },
  {
    id: "cloud-002",
    domain: "Cloud concepts",
    topic: "Cloud models",
    difficulty: 1,
    question_text: "A business wants to keep some systems in its own datacenter while using cloud services for others. Which cloud model best describes this approach?",
    options: ["Public cloud only", "Private cloud only", "Hybrid cloud", "Community cloud"],
    correct_index: 2,
    base_explanation: "A hybrid cloud combines a private environment, such as an organization's own datacenter, with public cloud services."
  },
  {
    id: "cloud-003",
    domain: "Cloud concepts",
    topic: "Consumption-based model",
    difficulty: 1,
    question_text: "What is a key idea behind the consumption-based model of cloud computing?",
    options: ["Pay for resources as you use them", "Pay once for unlimited resources", "Buy physical servers before using any service", "Keep the same fixed cost regardless of usage"],
    correct_index: 0,
    base_explanation: "In a consumption-based model, customers pay for the cloud resources they use rather than purchasing all of the underlying infrastructure up front."
  },
  {
    id: "cloud-004",
    domain: "Cloud concepts",
    topic: "IaaS, PaaS, and SaaS",
    difficulty: 2,
    question_text: "Which cloud service model gives a customer the most control over the operating system?",
    options: ["Software as a Service (SaaS)", "Platform as a Service (PaaS)", "Infrastructure as a Service (IaaS)", "Function as a Service (FaaS)"],
    correct_index: 2,
    base_explanation: "IaaS provides infrastructure such as virtual machines while giving the customer control over the operating system and applications. The provider manages the physical infrastructure."
  },
  {
    id: "cloud-005",
    domain: "Cloud concepts",
    topic: "Cloud benefits",
    difficulty: 1,
    question_text: "A team needs to increase computing capacity for a busy week and reduce it afterward. Which cloud benefit does this describe?",
    options: ["High availability", "Elasticity", "Governance", "Data residency"],
    correct_index: 1,
    base_explanation: "Elasticity is the ability to increase or decrease resources as demand changes."
  },
  {
    id: "arch-001",
    domain: "Azure architecture and services",
    topic: "Regions and availability zones",
    difficulty: 1,
    question_text: "What is an Azure region?",
    options: ["A billing account for one customer", "A geographic area containing one or more datacenters", "A single virtual machine", "A type of cloud subscription"],
    correct_index: 1,
    base_explanation: "An Azure region is a geographic area that contains one or more datacenters connected through a low-latency network."
  },
  {
    id: "arch-002",
    domain: "Azure architecture and services",
    topic: "Compute",
    difficulty: 1,
    question_text: "Which Azure service is designed to run virtual machines?",
    options: ["Azure Virtual Machines", "Azure Policy", "Azure Cost Management", "Azure DNS"],
    correct_index: 0,
    base_explanation: "Azure Virtual Machines provides on-demand virtualized computing resources, including control over the operating system."
  },
  {
    id: "arch-003",
    domain: "Azure architecture and services",
    topic: "Networking",
    difficulty: 1,
    question_text: "Which Azure service provides a logically isolated network for Azure resources?",
    options: ["Azure Blob Storage", "Azure Virtual Network", "Azure Advisor", "Azure Monitor"],
    correct_index: 1,
    base_explanation: "Azure Virtual Network enables Azure resources to communicate securely with each other, the internet, and on-premises networks."
  },
  {
    id: "arch-004",
    domain: "Azure architecture and services",
    topic: "Storage",
    difficulty: 1,
    question_text: "A team needs to store images and other unstructured data. Which Azure storage service is a suitable choice?",
    options: ["Azure Blob Storage", "Azure Virtual Network", "Azure Policy", "Azure Functions"],
    correct_index: 0,
    base_explanation: "Azure Blob Storage is designed to store large amounts of unstructured object data, such as images and documents."
  },
  {
    id: "arch-005",
    domain: "Azure architecture and services",
    topic: "Identity",
    difficulty: 2,
    question_text: "Which service helps an organization manage identities and control access to resources?",
    options: ["Microsoft Entra ID", "Azure Blob Storage", "Azure Pricing Calculator", "Azure Virtual Network"],
    correct_index: 0,
    base_explanation: "Microsoft Entra ID is a cloud-based identity and access management service. Azure role-based access control can be used to grant access to Azure resources."
  },
  {
    id: "mgmt-001",
    domain: "Azure management and governance",
    topic: "Cost management",
    difficulty: 1,
    question_text: "Which tool can help estimate the cost of Azure products before deployment?",
    options: ["Azure Pricing Calculator", "Azure Service Health", "Azure Resource Manager", "Microsoft Entra ID"],
    correct_index: 0,
    base_explanation: "The Azure Pricing Calculator helps estimate the cost of Azure products and services based on expected usage."
  },
  {
    id: "mgmt-002",
    domain: "Azure management and governance",
    topic: "Governance",
    difficulty: 2,
    question_text: "Which Azure service can help enforce rules, such as allowed resource locations, across subscriptions?",
    options: ["Azure Policy", "Azure Monitor", "Azure Virtual Machines", "Azure DNS"],
    correct_index: 0,
    base_explanation: "Azure Policy helps create, assign, and manage policies that enforce organizational rules and assess compliance across resources."
  },
  {
    id: "mgmt-003",
    domain: "Azure management and governance",
    topic: "Monitoring",
    difficulty: 1,
    question_text: "Which service collects and analyzes monitoring data from Azure resources?",
    options: ["Azure Monitor", "Azure Policy", "Azure Cost Management", "Azure Virtual Network"],
    correct_index: 0,
    base_explanation: "Azure Monitor collects and analyzes monitoring data from cloud and on-premises environments to help understand performance and availability."
  },
  {
    id: "mgmt-004",
    domain: "Azure management and governance",
    topic: "Management tools",
    difficulty: 2,
    question_text: "Which Azure feature organizes related resources so they can be managed together?",
    options: ["Resource groups", "Availability zones", "Regions", "Virtual network subnets"],
    correct_index: 0,
    base_explanation: "A resource group is a logical container for Azure resources that share a lifecycle and are managed together."
  },
  {
    id: "mgmt-005",
    domain: "Azure management and governance",
    topic: "Service level agreements",
    difficulty: 2,
    question_text: "What does an Azure service level agreement (SLA) generally describe?",
    options: ["A service's availability commitments and related terms", "The customer's password rules", "The exact monthly bill for every customer", "The physical location of all customer data"],
    correct_index: 0,
    base_explanation: "An SLA describes Microsoft's availability commitments for a service and may describe the terms that apply if those commitments are not met."
  }
];

export function selectBalancedQuestions(questions: Question[]) {
  return domains.flatMap((domain) => questions.filter((question) => question.domain === domain).slice(0, 5));
}
