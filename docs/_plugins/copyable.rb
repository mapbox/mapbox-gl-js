class CopyableBlock < Liquid::Block

  @@nextId = 0

  def initialize(tag_name, text, tokens)
    super
    @id = @@nextId
    @@nextId = @@nextId + 1
  end

  def render(context)
    "<div class='space-bottom1 contain'> \
      <a class='icon clipboard js-clipboard' style='position:absolute; right:10px; bottom:10px;' href='#' data-clipboard-target='copyable-#{@id}'></a> \
      <div id='copyable-#{@id}'>#{super}</div> \
    </div>"
  end
end

Liquid::Template.register_tag('copyable', CopyableBlock)
