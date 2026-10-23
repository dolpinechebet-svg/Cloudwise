insert into public.questions (
  domain,
  topic,
  difficulty,
  question_text,
  options,
  correct_index,
  base_explanation
)
values
  -- Cloud concepts
  (
    'Cloud concepts',
    'Shared responsibility',
    1,
    'In a public cloud environment, who is responsible for protecting the physical datacenter?',
    '["The customer","The cloud provider","The application developer","The internet service provider"]'::jsonb,
    1,
    'The cloud provider secures the physical datacenter and underlying cloud infrastructure. Customers remain responsible for their data and other responsibilities that vary by service model.'
  ),
  (
    'Cloud concepts',
    'IaaS, PaaS, and SaaS',
    2,
    'A team wants to deploy an application while retaining control of the virtual machine operating system. Which cloud service model best fits?',
    '["Software as a Service (SaaS)","Platform as a Service (PaaS)","Infrastructure as a Service (IaaS)","Public cloud"]'::jsonb,
    2,
    'IaaS gives the customer control over the virtual machine operating system and applications while the provider manages the physical infrastructure. PaaS and SaaS shift more of the underlying management to the provider.'
  ),
  (
    'Cloud concepts',
    'Cloud models',
    1,
    'An organization uses its own private datacenter together with public cloud services. Which deployment model describes this arrangement?',
    '["Public cloud","Private cloud","Hybrid cloud","Software as a Service"]'::jsonb,
    2,
    'A hybrid cloud combines a private environment with public cloud services. A public-only or private-only deployment does not combine both environments.'
  ),
  (
    'Cloud concepts',
    'Cloud benefits',
    1,
    'A service automatically adds resources during a traffic spike and removes them when demand falls. Which cloud benefit does this describe?',
    '["High availability","Elasticity","Data governance","Fault isolation"]'::jsonb,
    1,
    'Elasticity is the ability to increase or decrease resources as workload demand changes. High availability focuses on keeping a service accessible rather than matching capacity to changing demand.'
  ),
  (
    'Cloud concepts',
    'Consumption-based model',
    1,
    'Which statement best describes the consumption-based cloud model?',
    '["Customers pay for resources they use","Customers must buy physical servers before deployment","Every service has the same fixed monthly cost","Cloud services can only be paid for annually"]'::jsonb,
    0,
    'In a consumption-based model, charges are based on the cloud resources used. It does not require customers to purchase physical servers or use one fixed payment schedule for every service.'
  ),

  -- Azure architecture and services
  (
    'Azure architecture and services',
    'Regions and availability zones',
    1,
    'What is an Azure region?',
    '["A billing boundary for one user","A geographic area containing one or more datacenters","A single availability zone","A group of resource permissions"]'::jsonb,
    1,
    'An Azure region is a geographic area that contains one or more datacenters. A subscription is a management and billing boundary, not a geographic location.'
  ),
  (
    'Azure architecture and services',
    'Regions and availability zones',
    2,
    'A company wants to reduce the impact of a datacenter failure by deploying supported resources in separate physical locations within one Azure region. What should it use?',
    '["Resource groups","Availability zones","Management groups","Azure Policy"]'::jsonb,
    1,
    'Availability zones are physically separate locations within an Azure region and can help protect supported workloads from a datacenter-level failure. Resource groups and management groups organize resources but do not provide physical redundancy.'
  ),
  (
    'Azure architecture and services',
    'Compute',
    1,
    'Which Azure service provides virtual machines for workloads that need control of the guest operating system?',
    '["Azure Virtual Machines","Azure Functions","Azure Files","Azure Policy"]'::jsonb,
    0,
    'Azure Virtual Machines provides virtualized compute and lets customers manage the guest operating system. Azure Functions runs event-driven code, while Azure Files provides storage and Azure Policy evaluates resource compliance.'
  ),
  (
    'Azure architecture and services',
    'Storage',
    1,
    'A team needs to store a large collection of images and other unstructured objects. Which Azure service is designed for this use?',
    '["Azure Files","Azure Blob Storage","Azure Virtual Network","Microsoft Entra ID"]'::jsonb,
    1,
    'Azure Blob Storage is designed to store large amounts of unstructured object data such as images. Azure Files provides file shares, while a virtual network and Entra ID serve networking and identity purposes.'
  ),
  (
    'Azure architecture and services',
    'Identity',
    2,
    'Which service provides cloud identity and authentication capabilities such as managing user sign-in?',
    '["Azure Monitor","Microsoft Entra ID","Azure Blob Storage","Azure Resource Manager"]'::jsonb,
    1,
    'Microsoft Entra ID is Microsoft''s cloud identity and access management service and supports user authentication. Azure Monitor handles telemetry, Blob Storage stores data, and Azure Resource Manager manages Azure deployments.'
  ),

  -- Azure management and governance
  (
    'Azure management and governance',
    'Governance',
    2,
    'An organization wants to audit or restrict deployments to approved Azure regions. Which service should it use?',
    '["Azure Policy","Azure Monitor","Azure Cost Management","Microsoft Entra ID"]'::jsonb,
    0,
    'Azure Policy can audit or enforce rules such as allowed resource locations. Azure Monitor observes telemetry, Cost Management analyzes spending, and Entra ID manages identities.'
  ),
  (
    'Azure management and governance',
    'Governance',
    2,
    'An administrator wants to grant a colleague permission to view Azure resources without changing them. Which feature is appropriate?',
    '["Azure Policy","Resource locks","Role-based access control (RBAC)","Azure Advisor"]'::jsonb,
    2,
    'Azure RBAC assigns permissions to users, groups, or applications at a chosen scope, and the Reader role allows viewing without changing resources. Azure Policy evaluates configurations, while resource locks protect against certain modifications or deletions.'
  ),
  (
    'Azure management and governance',
    'Governance',
    2,
    'Which Azure feature can help prevent an important resource from being accidentally deleted?',
    '["A resource lock","A cost alert","A management group","An availability zone"]'::jsonb,
    0,
    'A CanNotDelete resource lock helps prevent a resource from being deleted until the lock is removed. Cost alerts report spending, while management groups and availability zones serve organization and resilience purposes.'
  ),
  (
    'Azure management and governance',
    'Monitoring',
    1,
    'Which Azure service collects and analyzes telemetry such as metrics and logs from resources?',
    '["Azure Policy","Azure Monitor","Azure Pricing Calculator","Microsoft Purview"]'::jsonb,
    1,
    'Azure Monitor collects and analyzes monitoring data, including metrics and logs. Azure Policy evaluates compliance, the Pricing Calculator estimates planned costs, and Microsoft Purview supports data governance.'
  ),
  (
    'Azure management and governance',
    'Cost management',
    1,
    'Which Azure tool helps review and analyze actual cloud spending after resources have been deployed?',
    '["Azure Pricing Calculator","Azure Cost Management","Azure Service Health","Azure Resource Manager"]'::jsonb,
    1,
    'Azure Cost Management helps analyze and manage actual cloud costs, including budgets. The Pricing Calculator estimates costs before deployment, while Service Health reports service issues and Resource Manager handles deployment and management.'
  );
