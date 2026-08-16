import json
import os
import networkx as nx
from typing import List, Dict, Any
from config import get_settings
from openai import AsyncOpenAI
import structlog

logger = structlog.get_logger()
settings = get_settings()

GRAPH_PATH = os.path.join(settings.okf_knowledge_dir, "neuro_graph.json")

class NeuroGraphBuilder:
    def __init__(self):
        self.graph = nx.DiGraph()
        self._load_graph()

    def _load_graph(self):
        if os.path.exists(GRAPH_PATH):
            try:
                with open(GRAPH_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.graph = nx.node_link_graph(data)
                logger.info("NeuroGraph loaded", nodes=self.graph.number_of_nodes(), edges=self.graph.number_of_edges())
            except Exception as e:
                logger.error("Failed to load NeuroGraph", error=str(e))
                self.graph = nx.DiGraph()
        else:
            self.graph = nx.DiGraph()

    def _save_graph(self):
        try:
            data = nx.node_link_data(self.graph)
            os.makedirs(os.path.dirname(GRAPH_PATH), exist_ok=True)
            with open(GRAPH_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            logger.info("NeuroGraph saved", nodes=self.graph.number_of_nodes(), edges=self.graph.number_of_edges())
        except Exception as e:
            logger.error("Failed to save NeuroGraph", error=str(e))

    async def extract_and_add_to_graph(self, text: str, source_id: str):
        """Extract entities and relations from text using LLM and add to Graph."""
        if not text.strip():
            return

        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.llm_base_url,
        )

        prompt = (
            "You are a Knowledge Graph Extractor. Extract the key entities and relationships from the text.\n"
            "Respond ONLY with a valid JSON array of relationships. Each object must have:\n"
            '{"source": "Entity1", "target": "Entity2", "relation": "relationship description"}\n'
            "If no clear relationships exist, return [].\n\n"
            f"Text: {text[:2000]}"
        )

        try:
            response = await client.chat.completions.create(
                model=settings.llm_chat_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1000
            )
            content = response.choices[0].message.content
            
            start = content.find('[')
            end = content.rfind(']')
            if start != -1 and end != -1:
                relations = json.loads(content[start:end+1])
            else:
                try:
                    obj = json.loads(content)
                    relations = obj.get("relations", []) if isinstance(obj, dict) else obj
                except json.JSONDecodeError:
                    relations = []

            added = 0
            for rel in relations:
                if isinstance(rel, dict) and 'source' in rel and 'target' in rel and 'relation' in rel:
                    src = str(rel['source']).strip().lower()
                    tgt = str(rel['target']).strip().lower()
                    relation = str(rel['relation']).strip()
                    if src and tgt:
                        self.graph.add_edge(src, tgt, relation=relation, source_id=source_id)
                        added += 1
            
            if added > 0:
                self._save_graph()
                
        except Exception as e:
            logger.warning("NeuroGraph extraction failed", error=str(e))

    def query_graph(self, query: str, max_hops: int = 2) -> str:
        """Search graph for query keywords and return synthesized context from multi-hop traversal."""
        if self.graph.number_of_nodes() == 0:
            return ""

        words = set(query.lower().split())
        matched_nodes = []
        for node in self.graph.nodes():
            if any(w in node for w in words if len(w) > 3):
                matched_nodes.append(node)

        if not matched_nodes:
            return ""

        context_lines = []
        visited = set()
        
        for start_node in matched_nodes[:3]:
            edges = nx.bfs_edges(self.graph, start_node, depth_limit=max_hops)
            for u, v in edges:
                edge_data = self.graph.get_edge_data(u, v)
                relation = edge_data.get('relation', 'is related to')
                fact = f"- {u.title()} {relation} {v.title()}."
                if fact not in visited:
                    visited.add(fact)
                    context_lines.append(fact)

        if context_lines:
            return "Neuro-Graph Context:\n" + "\n".join(context_lines)
        return ""

    def get_full_graph(self) -> dict:
        """Return the entire graph in node-link format."""
        return nx.node_link_data(self.graph)

    def get_subgraph(self, target_query: str, max_hops: int = 2) -> dict:
        """Return a subgraph centered around a specific target query."""
        if self.graph.number_of_nodes() == 0:
            return nx.node_link_data(nx.DiGraph())

        # Try to find a matching node
        target = target_query.lower()
        matched_nodes = [n for n in self.graph.nodes() if target in n]
        
        if not matched_nodes:
            # Fallback if no exact match but we want to simulate
            return nx.node_link_data(nx.DiGraph())

        # Build subgraph around the matches
        nodes_to_keep = set()
        for start_node in matched_nodes:
            nodes_to_keep.add(start_node)
            
            # Forward edges
            edges_fwd = nx.bfs_edges(self.graph, start_node, depth_limit=max_hops)
            for u, v in edges_fwd:
                nodes_to_keep.add(u)
                nodes_to_keep.add(v)
            
            # Reverse edges (dependencies)
            rev_graph = self.graph.reverse()
            edges_rev = nx.bfs_edges(rev_graph, start_node, depth_limit=max_hops)
            for u, v in edges_rev:
                nodes_to_keep.add(u)
                nodes_to_keep.add(v)

        subgraph = self.graph.subgraph(nodes_to_keep)
        return nx.node_link_data(subgraph)

def get_graph_builder():
    return NeuroGraphBuilder()
