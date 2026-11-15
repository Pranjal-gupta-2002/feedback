from fastapi import APIRouter
from ..database import products_col, tags_col, channels_col, reviews_col
from ..schemas.review import MetadataResponse

router = APIRouter(tags=["Metadata"])

DEFAULT_CHANNELS = [
    "Direct Web",
    "Nike SNKRS App",
    "Shopify Store",
    "Amazon Global",
    "In-App iOS"
]

DEFAULT_TAGS = [
    "Cushioning",
    "Comfort",
    "Durability",
    "Fit & Sizing",
    "Traction",
    "Breathability"
]

@router.get("/metadata", response_model=MetadataResponse)
def get_form_metadata():
    """
    Unified metadata endpoint.
    Returns products catalog, tags, and sales channels in a single response.
    """
    # 1. Products
    products = list(products_col.find({}, {"_id": 0}))
    known_skus = {p.get("sku") for p in products if p.get("sku")}
    
    # Check for any reviews with products not yet in the products collection
    review_products = reviews_col.aggregate([
        {"$match": {"sku": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$sku", "name": {"$first": "$product_name"}}}
    ])
    for rp in review_products:
        sku = rp["_id"]
        if sku and sku not in known_skus:
            products.append({
                "sku": sku,
                "name": rp.get("name") or sku,
                "category": "Footwear",
                "attribute": "Performance",
                "icon": "steps"
            })
            known_skus.add(sku)

    # 2. Channels
    channel_docs = list(channels_col.find({}, {"name": 1, "_id": 0}))
    channels = [d["name"] for d in channel_docs if d.get("name")]
    review_channels = [c for c in reviews_col.distinct("channel") if c]
    merged_channels = list(dict.fromkeys(channels + review_channels + DEFAULT_CHANNELS))

    # 3. Tags
    tag_docs = list(tags_col.find({}, {"name": 1, "_id": 0}))
    tags = [d["name"] for d in tag_docs if d.get("name")]
    merged_tags = list(dict.fromkeys(tags + DEFAULT_TAGS))

    return {
        "products": products,
        "tags": merged_tags,
        "channels": merged_channels
    }
