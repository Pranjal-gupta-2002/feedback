from fastapi import APIRouter
from ..database import products_col, tags_col, channels_col
from ..schemas.review import MetadataResponse

router = APIRouter(tags=["Metadata"])

@router.get("/metadata", response_model=MetadataResponse)
def get_form_metadata():
    """
    Unified metadata endpoint.
    Returns products catalog, tags, and sales channels in a single response.
    """
    products = list(products_col.find({}, {"_id": 0}))
    tags = [d["name"] for d in tags_col.find({}, {"name": 1, "_id": 0})]
    channels = [d["name"] for d in channels_col.find({}, {"name": 1, "_id": 0})]
    return {
        "products": products,
        "tags": tags,
        "channels": channels
    }
