${imports_block}

class ${class_name}Create(BaseModel):
${create_fields}


class ${class_name}Update(BaseModel):
${update_fields}


class ${class_name}Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

${read_fields}
${tree_node_class}