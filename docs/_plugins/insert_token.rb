module InsertToken
    def insert_token(input)
        input.sub("<script>", "<script>\nmapboxgl.accessToken = '<your access token here>';")
    end
end

Liquid::Template.register_filter(InsertToken)
