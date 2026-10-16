from rest_framework import serializers
from .models import AcademicYear, FeeTerm, FeeStructure, FeeItem


class AcademicYearListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='academic_year_id', read_only=True)
    code = serializers.CharField(source='year_code', read_only=True)
    name = serializers.CharField(source='year_name', read_only=True)
    start = serializers.DateField(source='start_date', read_only=True)
    end = serializers.DateField(source='end_date', read_only=True)
    created = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = AcademicYear
        fields = [
            'id', 'code', 'name',
            'is_current', 'status',
            'start', 'end',
            'created',
        ]


class AcademicYearSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='academic_year_id', read_only=True)

    class Meta:
        model = AcademicYear
        fields = [
            'id',
            'year_code', 'year_name',
            'start_date', 'end_date',
            'is_current', 'status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['academic_year_id', 'created_at', 'updated_at']


class FeeTermListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='fee_term_id', read_only=True)
    academic_year_id = serializers.UUIDField(source='academic_year.academic_year_id', read_only=True)
    academic_year_code = serializers.CharField(source='academic_year.year_code', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.year_name', read_only=True)

    class Meta:
        model = FeeTerm
        fields = [
            'id',
            'academic_year_id', 'academic_year_code', 'academic_year_name',
            'term_code', 'term_name', 'term_frequency',
            'start_date', 'end_date', 'due_date',
            'status',
        ]


class FeeTermSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='fee_term_id', read_only=True)
    academic_year_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = FeeTerm
        fields = [
            'id',
            'academic_year', 'academic_year_detail',
            'term_code', 'term_name', 'term_frequency',
            'start_date', 'end_date', 'due_date',
            'status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['fee_term_id', 'created_at', 'updated_at']

    def get_academic_year_detail(self, obj):
        if getattr(obj, 'academic_year_id', None) is None:
            return None
        try:
            ay = obj.academic_year
            return {
                'id': ay.academic_year_id,
                'code': ay.year_code,
                'name': ay.year_name,
                'is_current': ay.is_current,
                'status': ay.status,
                'start': ay.start_date.isoformat() if ay.start_date else None,
                'end': ay.end_date.isoformat() if ay.end_date else None,
                'created': ay.created_at.isoformat() if ay.created_at else None,
            }
        except Exception:
            return None


class FeeStructureListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='fee_structure_id', read_only=True)
    school_id = serializers.UUIDField(source='school.school_id', read_only=True)
    school_code = serializers.CharField(source='school.school_code', read_only=True)
    school_name = serializers.CharField(source='school.school_name', read_only=True)
    academic_year_id = serializers.UUIDField(source='academic_year.academic_year_id', read_only=True)
    academic_year_code = serializers.CharField(source='academic_year.year_code', read_only=True)
    payment_terms_id = serializers.UUIDField(source='payment_terms.fee_term_id', read_only=True, allow_null=True)
    payment_terms_name = serializers.CharField(source='payment_terms.term_name', read_only=True, allow_null=True)

    class Meta:
        model = FeeStructure
        fields = [
            'id',
            'structure_code', 'structure_name',
            'school_id', 'school_code', 'school_name',
            'academic_year_id', 'academic_year_code',
            'effective_from', 'effective_to',
            'payment_terms_id', 'payment_terms_name',
            'status', 'published',
        ]


class FeeStructureSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='fee_structure_id', read_only=True)
    school_detail = serializers.SerializerMethodField(read_only=True)
    academic_year_detail = serializers.SerializerMethodField(read_only=True)
    payment_terms_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = FeeStructure
        fields = [
            'id',
            'structure_code', 'structure_name',
            'school', 'school_detail',
            'academic_year', 'academic_year_detail',
            'effective_from', 'effective_to',
            'payment_terms', 'payment_terms_detail',
            'description',
            'status', 'published', 'published_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['fee_structure_id', 'published_at', 'created_at', 'updated_at']

    def get_school_detail(self, obj):
        if getattr(obj, 'school_id', None) is None:
            return None
        try:
            s = obj.school
            return {
                'school_id': s.school_id,
                'school_code': s.school_code,
                'school_name': s.school_name,
            }
        except Exception:
            return None

    def get_academic_year_detail(self, obj):
        if getattr(obj, 'academic_year_id', None) is None:
            return None
        try:
            ay = obj.academic_year
            return {
                'id': ay.academic_year_id,
                'code': ay.year_code,
                'name': ay.year_name,
                'is_current': ay.is_current,
                'status': ay.status,
                'start': ay.start_date.isoformat() if ay.start_date else None,
                'end': ay.end_date.isoformat() if ay.end_date else None,
            }
        except Exception:
            return None

    def get_payment_terms_detail(self, obj):
        if getattr(obj, 'payment_terms_id', None) is None:
            return None
        try:
            ft = obj.payment_terms
            data = {
                'id': ft.fee_term_id,
                'term_code': ft.term_code,
                'term_name': ft.term_name,
                'term_frequency': ft.term_frequency,
                'start_date': ft.start_date.isoformat() if ft.start_date else None,
                'end_date': ft.end_date.isoformat() if ft.end_date else None,
                'due_date': ft.due_date.isoformat() if ft.due_date else None,
                'status': ft.status,
            }
            if getattr(ft, 'academic_year_id', None):
                try:
                    data.update({
                        'academic_year_id': ft.academic_year.academic_year_id,
                        'academic_year_code': ft.academic_year.year_code,
                        'academic_year_name': ft.academic_year.year_name,
                    })
                except Exception:
                    pass
            return data
        except Exception:
            return None


class FeeItemListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='fee_item_id', read_only=True)
    fee_structure_id = serializers.UUIDField(source='fee_structure.fee_structure_id', read_only=True)
    fee_structure_code = serializers.CharField(source='fee_structure.structure_code', read_only=True)
    grade_id = serializers.UUIDField(source='grade.grade_id', read_only=True, allow_null=True)
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True, allow_null=True)
    school_type_id = serializers.UUIDField(source='school_type.school_type_id', read_only=True, allow_null=True)
    school_type_name = serializers.CharField(source='school_type.type_name', read_only=True, allow_null=True)
    tax = serializers.DecimalField(source='tax_rate_pct', max_digits=5, decimal_places=2, read_only=True)
    category = serializers.CharField(source='item_category', read_only=True)
    payment_frequency_display = serializers.CharField(
        source='get_payment_frequency_display',
        read_only=True,
    )

    class Meta:
        model = FeeItem
        fields = [
            'id',
            'fee_structure_id', 'fee_structure_code',
            'item_code', 'item_name', 'category',
            'grade_id', 'grade_name',
            'school_type_id', 'school_type_name',
            'amount', 'payment_frequency', 'payment_frequency_display', 'tax',
            'is_refundable',
            'sort_order',
        ]


class FeeItemSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='fee_item_id', read_only=True)
    fee_structure_detail = serializers.SerializerMethodField(read_only=True)
    grade_detail = serializers.SerializerMethodField(read_only=True)
    school_type_detail = serializers.SerializerMethodField(read_only=True)
    tax = serializers.DecimalField(source='tax_rate_pct', max_digits=5, decimal_places=2, read_only=True)
    category = serializers.CharField(source='item_category', read_only=True)
    payment_frequency_display = serializers.CharField(
        source='get_payment_frequency_display',
        read_only=True,
    )

    class Meta:
        model = FeeItem
        fields = [
            'id',
            'fee_structure', 'fee_structure_detail',
            'item_code', 'item_name', 'category',
            'grade', 'grade_detail',
            'school_type', 'school_type_detail',
            'amount', 'payment_frequency', 'payment_frequency_display',
            'tax', 'tax_rate_pct',
            'is_refundable',
            'description',
            'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['fee_item_id', 'created_at', 'updated_at']

    def get_fee_structure_detail(self, obj):
        if getattr(obj, 'fee_structure_id', None) is None:
            return None
        try:
            fs = obj.fee_structure
            data = {
                'id': fs.fee_structure_id,
                'structure_code': fs.structure_code,
                'structure_name': fs.structure_name,
                'effective_from': fs.effective_from.isoformat() if fs.effective_from else None,
                'effective_to': fs.effective_to.isoformat() if fs.effective_to else None,
                'status': fs.status,
                'published': fs.published,
            }
            if getattr(fs, 'school_id', None):
                try:
                    data.update({
                        'school_id': fs.school.school_id,
                        'school_code': fs.school.school_code,
                        'school_name': fs.school.school_name,
                    })
                except Exception:
                    pass
            if getattr(fs, 'academic_year_id', None):
                try:
                    data.update({
                        'academic_year_id': fs.academic_year.academic_year_id,
                        'academic_year_code': fs.academic_year.year_code,
                    })
                except Exception:
                    pass
            if getattr(fs, 'payment_terms_id', None):
                try:
                    data.update({
                        'payment_terms_id': fs.payment_terms.fee_term_id,
                        'payment_terms_name': fs.payment_terms.term_name,
                    })
                except Exception:
                    pass
            return data
        except Exception:
            return None

    def get_grade_detail(self, obj):
        if getattr(obj, 'grade_id', None) is None:
            return None
        try:
            g = obj.grade
            return {
                'grade_id': g.grade_id,
                'grade_code': g.grade_code,
                'grade_name': g.grade_name,
            }
        except Exception:
            return None

    def get_school_type_detail(self, obj):
        if getattr(obj, 'school_type_id', None) is None:
            return None
        try:
            st = obj.school_type
            return {
                'school_type_id': st.school_type_id,
                'type_code': st.type_code,
                'type_name': st.type_name,
            }
        except Exception:
            return None
