from django.conf.urls import patterns, url
from django.views.generic import TemplateView
from marvelize.views import views

# RESTful stuffs
from tastypie.api import Api
#from marvelize.api import Resource
from django.conf.urls import include
from django.conf import settings

v1_api = Api(api_name='v1')
#v1_api.register(Resource())

urlpatterns = patterns('',
    url(r'^api/', include(v1_api.urls)),
    #url(r'^foo$', views.foo, name='foo'),
    url(r'^$', TemplateView.as_view(template_name='index.html')),
    url(r'^static/(?P<path>.*)$', 'django.views.static.serve', {'document_root': settings.STATIC_ROOT}),
)
