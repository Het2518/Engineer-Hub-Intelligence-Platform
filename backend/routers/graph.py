from fastapi import APIRouter, Depends
from pydantic import BaseModel
from services.graph_builder import get_graph_builder, NeuroGraphBuilder
from config import get_settings
from openai import AsyncOpenAI
import structlog

router = APIRouter(prefix="/graph", tags=["graph"])
logger = structlog.get_logger()
settings = get_settings()

class BlastRadiusRequest(BaseModel):
    query: str

@router.get("/data")
async def get_graph_data(graph_builder: NeuroGraphBuilder = Depends(get_graph_builder)):
    """Return the full neuro-graph for 3D visualization."""
    data = graph_builder.get_full_graph()
    # ForceGraph3D expects "links", NetworkX < 3.0 outputs "edges"
    if "edges" in data:
        data["links"] = data.pop("edges")
    return data

@router.post("/blast-radius")
async def simulate_blast_radius(
    req: BlastRadiusRequest,
    graph_builder: NeuroGraphBuilder = Depends(get_graph_builder)
):
    """
    Simulate a structural change (e.g. replacing a DB, dropping a microservice).
    Returns a subgraph of affected components and an LLM summary of the blast radius.
    """
    logger.info("Blast radius simulation", query=req.query)
    
    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.llm_base_url,
    )
    
    # 1. Ask LLM to identify the target component from the query
    target_prompt = (
        "Extract the core architectural component name from the following 'what if' query.\n"
        "Return ONLY the component name as a single string, no explanation.\n"
        f"Query: {req.query}"
    )
    
    try:
        res = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[
                {"role": "system", "content": "You are a precise entity extractor."},
                {"role": "user", "content": target_prompt}
            ],
            temperature=0.1,
            max_tokens=50
        )
        target_component = res.choices[0].message.content.strip(' "\'')
    except Exception as e:
        logger.error("Failed to extract target component", error=str(e))
        target_component = req.query

    logger.info("Extracted blast radius target", target=target_component)
    
    # 2. Get subgraph
    subgraph_data = graph_builder.get_subgraph(target_component, max_hops=3)
    
    # NetworkX < 3.0 outputs "edges", ForceGraph3D expects "links"
    if "edges" in subgraph_data:
        subgraph_data["links"] = subgraph_data.pop("edges")
    
    # 3. Use LLM to summarize impact based on subgraph
    nodes = [n["id"] for n in subgraph_data.get("nodes", [])]
    
    if not nodes:
        return {
            "summary": f"Could not find component '{target_component}' in the Knowledge Graph. Simulation aborted.",
            "subgraph": subgraph_data
        }
        
    edges_str = ", ".join([f"{e['source']} -> {e['target']} ({e.get('relation', '')})" for e in subgraph_data.get("links", [])])
    
    impact_prompt = (
        f"The user is asking: {req.query}\n"
        f"The target component is '{target_component}'.\n"
        f"Based on the Knowledge Graph, the following nodes are in the blast radius: {', '.join(nodes)}.\n"
        f"Dependencies/Relations: {edges_str}\n\n"
        "Write a concise, highly technical Blast Radius Assessment report (in Markdown). "
        "Include what systems will go down, what runbooks must be updated, and the risk level (Low/Med/High/Critical)."
    )
    
    try:
        summary_res = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[
                {"role": "system", "content": "You are a Senior Principal Architect."},
                {"role": "user", "content": impact_prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        summary = summary_res.choices[0].message.content
    except Exception as e:
        logger.error("Failed to generate summary", error=str(e))
        summary = "Failed to generate Blast Radius Assessment due to an LLM error."
    
    return {
        "summary": summary,
        "subgraph": subgraph_data
    }

class PRImpactRequest(BaseModel):
    pr_url: str

@router.post("/pr-impact")
async def simulate_pr_impact(
    req: PRImpactRequest,
    graph_builder: NeuroGraphBuilder = Depends(get_graph_builder)
):
    logger.info("PR impact simulation", pr=req.pr_url)
    client = AsyncOpenAI(api_key=settings.groq_api_key, base_url=settings.llm_base_url)
    
    # Mock extracting components from PR
    target_prompt = f"Extract the core architectural component name that would be modified by a PR titled or described by: {req.pr_url}. Return ONLY the component name as a single string, no explanation."
    try:
        res = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[
                {"role": "system", "content": "You are a precise entity extractor."},
                {"role": "user", "content": target_prompt}
            ],
            temperature=0.1, max_tokens=50
        )
        target_component = res.choices[0].message.content.strip(' "\'')
    except:
        target_component = "auth-service"

    subgraph_data = graph_builder.get_subgraph(target_component, max_hops=2)
    if "edges" in subgraph_data:
        subgraph_data["links"] = subgraph_data.pop("edges")
        
    nodes = [n["id"] for n in subgraph_data.get("nodes", [])]
    if not nodes:
        return {"summary": "No affected components found.", "subgraph": subgraph_data}
        
    edges_str = ", ".join([f"{e['source']} -> {e['target']}" for e in subgraph_data.get("links", [])])
    impact_prompt = f"PR: {req.pr_url}\nComponent: {target_component}\nAffected nodes: {', '.join(nodes)}.\nEdges: {edges_str}\nWrite a GitOps PR Review focusing ONLY on architectural impact and test coverage required. Use Markdown."
    
    try:
        summary_res = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[
                {"role": "system", "content": "You are a Senior Staff Engineer reviewing a PR."},
                {"role": "user", "content": impact_prompt}
            ],
            temperature=0.3, max_tokens=1000
        )
        summary = summary_res.choices[0].message.content
    except:
        summary = "Failed to generate PR analysis."
        
    return {"summary": summary, "subgraph": subgraph_data}

class FinOpsRequest(BaseModel):
    query: str

@router.post("/finops")
async def simulate_finops(
    req: FinOpsRequest,
    graph_builder: NeuroGraphBuilder = Depends(get_graph_builder)
):
    logger.info("FinOps simulation", query=req.query)
    client = AsyncOpenAI(api_key=settings.groq_api_key, base_url=settings.llm_base_url)
    
    target_prompt = f"Extract the core component name from this FinOps query: {req.query}. Return ONLY the component name."
    try:
        res = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[{"role": "system", "content": "You are a precise entity extractor."},{"role": "user", "content": target_prompt}],
            temperature=0.1, max_tokens=50
        )
        target_component = res.choices[0].message.content.strip(' "\'')
    except:
        target_component = "payments-api"

    subgraph_data = graph_builder.get_subgraph(target_component, max_hops=3)
    if "edges" in subgraph_data:
        subgraph_data["links"] = subgraph_data.pop("edges")
        
    nodes_info = []
    total_base_cost = 0.0
    for n in subgraph_data.get("nodes", []):
        cost = n.get("cost_per_hour", 0)
        total_base_cost += cost
        nodes_info.append(f"{n['id']} (/hr)")
        
    if not nodes_info:
        return {"summary": "No components found for cost analysis.", "subgraph": subgraph_data}
        
    impact_prompt = f"Query: {req.query}\nTarget: {target_component}\nAffected nodes and base costs: {', '.join(nodes_info)}.\nTotal base cost: /hr.\nWrite a FinOps Cost Projection Report (Markdown). Estimate the percentage increase in downstream costs and highlight the most expensive bottlenecks."
    
    try:
        summary_res = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[{"role": "system", "content": "You are a Cloud FinOps Architect."},{"role": "user", "content": impact_prompt}],
            temperature=0.3, max_tokens=1000
        )
        summary = summary_res.choices[0].message.content
    except:
        summary = "Failed to generate FinOps analysis."
        
    return {"summary": summary, "subgraph": subgraph_data}

class RemediateRequest(BaseModel):
    target_component: str
    blast_radius_summary: str

@router.post("/remediate")
async def generate_remediation(req: RemediateRequest):
    logger.info("Remediation generation", target=req.target_component)
    client = AsyncOpenAI(api_key=settings.groq_api_key, base_url=settings.llm_base_url)
    
    prompt = f"The component '{req.target_component}' has a critical blast radius. Here is the incident simulation report:\n\n{req.blast_radius_summary}\n\nWrite a highly technical Architecture Refactoring Proposal (Markdown) to remediate this SPOF. Suggest specific patterns (e.g. Circuit Breakers, Fallbacks) and provide a pseudo-code implementation snippet."
    try:
        res = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[{"role": "system", "content": "You are a Principal Cloud Architect."},{"role": "user", "content": prompt}],
            temperature=0.4, max_tokens=1500
        )
        remediation = res.choices[0].message.content
    except:
        remediation = "Failed to generate remediation plan."
        
    return {"remediation": remediation}
