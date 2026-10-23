# AZ-900 Study Guide

This concise review guide follows the three AZ-900 knowledge areas. Azure features and the exam skills outline can change, so use Microsoft's [official AZ-900 study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900) as the source of truth for the current exam.

## 1. Describe cloud concepts

### Cloud benefits

- **High availability** keeps a service accessible with minimal interruption, often by using redundant components.
- **Reliability** is the ability of a system to recover from failures and continue operating as expected.
- **Scalability** is the ability to handle increased workload by adding resources. Vertical scaling increases the capacity of a resource; horizontal scaling adds instances.
- **Elasticity** adjusts resources as demand changes, scaling up or down as needed.
- **Predictability** helps estimate performance and costs using monitoring, planning, and consistent operating practices.
- **Security and governance** are supported by cloud-provider infrastructure and cloud tools, but customers still have responsibilities.

### Spending and deployment models

| Concept | Remember |
| --- | --- |
| Capital expenditure (CapEx) | Upfront investment in physical infrastructure, such as purchasing datacenter servers. |
| Operational expenditure (OpEx) | Ongoing spending for services as they are used; cloud consumption commonly follows this model. |
| Public cloud | A provider makes cloud services available to customers over a network using provider-managed infrastructure. |
| Private cloud | Cloud infrastructure is dedicated to one organization; it may be hosted by that organization or a provider. |
| Hybrid cloud | Combines private infrastructure with public cloud services. |

### Shared responsibility and service models

The cloud provider is responsible for the physical datacenter and underlying infrastructure. Customers remain responsible for their data, identities, access, and configuration; responsibility for operating systems and applications depends on the service model.

| Model | Customer focus | Example |
| --- | --- | --- |
| IaaS | Configure and manage the operating system, network settings, and applications. | Azure Virtual Machines |
| PaaS | Build and manage applications and data while the provider manages the platform. | Azure App Service |
| SaaS | Use and configure a ready-to-use application; manage users and data appropriately. | Microsoft 365 |

The provider generally manages more of the stack as you move from IaaS to PaaS to SaaS. The customer never stops being responsible for their data and appropriate access.

## 2. Describe Azure architecture and services

### Resource organization

The Azure management hierarchy is **management groups → subscriptions → resource groups → resources**.

- **Management groups** organize subscriptions for governance and access management.
- **Subscriptions** provide an administrative and billing boundary for Azure resources.
- **Resource groups** are logical containers used to manage related resources. A resource belongs to one resource group at a time; its resource group and the resource itself can have different locations.
- **Resources** are individual Azure services, such as a virtual machine or storage account.

### Global infrastructure

- A **region** is a geographic area containing one or more Azure datacenters.
- **Availability zones** are physically separate locations within a region, designed to reduce the impact of a datacenter-level failure.
- **Region pairs** are used by Azure for certain platform and disaster-recovery scenarios. Pairing does not by itself make an application resilient; design and configure recovery for the workload.
- **Sovereign regions** are separate cloud environments designed for specific government or regulatory requirements.

### Common services and when to use them

| Need | Azure service | Key distinction |
| --- | --- | --- |
| Control the operating system | Virtual Machines | IaaS virtualized compute. |
| Host a web app without managing the underlying operating system | App Service | Managed application platform (PaaS). |
| Run code in response to events | Azure Functions | Event-driven serverless compute. |
| Create a private network for Azure resources | Virtual Network (VNet) | Network isolation and connectivity. |
| Connect a site to Azure over an encrypted internet tunnel | VPN Gateway | VPN connectivity uses the public internet. |
| Connect a site to Microsoft cloud services using private connectivity | ExpressRoute | Private connectivity that does not traverse the public internet. |
| Store unstructured objects such as images and backups | Blob Storage | Object storage. |
| Provide managed file shares | Azure Files | File shares accessible through common file-sharing protocols. |

### Identity and security

- **Microsoft Entra ID** manages identities and authentication, including single sign-on and multifactor authentication.
- **Authentication** verifies identity; **authorization** determines what an authenticated identity can do.
- **Conditional Access** evaluates signals such as user, device, location, and risk to apply access requirements.
- **Zero Trust** uses three principles: verify explicitly, use least-privilege access, and assume breach.
- **Azure RBAC** grants users, groups, or applications permissions to Azure resources at a selected scope.

## 3. Describe Azure management and governance

### Cost management

- The **Azure Pricing Calculator** estimates the cost of planned Azure services.
- The **Total Cost of Ownership (TCO) Calculator** compares estimated on-premises costs with an Azure alternative.
- **Azure Cost Management** helps analyze actual cloud spending, set budgets, and monitor costs.

### Governance and compliance

- **Azure Policy** audits or enforces organizational rules, such as allowed resource locations.
- **Azure RBAC** determines who can perform actions. Policy determines whether resource configurations comply with rules.
- **Resource locks** help protect resources from accidental deletion or modification. They do not replace access control.
- **Microsoft Purview** supports data discovery and governance across an organization's data estate.

### Deployment and management

- **Azure Resource Manager (ARM)** is Azure's management and deployment layer.
- **Infrastructure as code (IaC)** describes infrastructure in files so it can be deployed consistently. ARM templates use JSON; Bicep is another Azure IaC language.
- **Azure Arc** extends Azure management capabilities to supported resources outside Azure, including on-premises and other-cloud environments.
- **Azure Portal** is a web interface; **Azure CLI** and **Azure PowerShell** are command-line tools; **Azure Cloud Shell** provides a browser-accessible shell.

### Monitoring and recommendations

- **Azure Monitor** collects and analyzes telemetry, including metrics and logs.
- **Log Analytics** queries log data; **Application Insights** helps monitor application behavior and performance.
- **Azure Service Health** reports Azure service issues, planned maintenance, and health advisories relevant to your resources.
- **Azure Advisor** provides recommendations across areas such as cost, security, reliability, performance, and operational excellence.

## Quick self-check

1. Need to allow or deny resources in particular locations? Choose **Azure Policy**.
2. Need to grant a person read-only permissions on resources? Choose **Azure RBAC** and an appropriate role.
3. Need an estimate before deploying a specific Azure solution? Use the **Pricing Calculator**.
4. Need to compare datacenter costs with a cloud migration? Use the **TCO Calculator**.
5. Need event-triggered code without server management? Consider **Azure Functions**.
6. Need high availability across datacenter failures? Design for **availability zones** where the service and region support them; verify the workload's own resilience requirements.

These are original study notes and practice prompts, not official exam questions. For current objectives and exam logistics, consult Microsoft's official materials linked above.
